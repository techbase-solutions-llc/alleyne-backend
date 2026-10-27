'use strict';
const { legacySyncSender } = require('../../../utils/legacy-sync-sender');

const { parseSitemapUrls, isSitemapIndex } = require('./sitemap-parser');
const { classifyUrl, classifyContent } = require('./policy-classifier');
const { extractFields } = require('./field-extractor');

const FETCH_OPTS = {
  headers: { 'User-Agent': 'Realtlist-Bot/1.0 (+https://realtlist.com/bot)' },
};

function timeout(ms) {
  return AbortSignal.timeout(ms);
}

async function fetchText(url, ms = 15000) {
  const resp = await fetch(url, { ...FETCH_OPTS, signal: timeout(ms) });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.text();
}

async function collectListingUrls(connection) {
  const base = connection.domain.startsWith('http')
    ? connection.domain
    : 'https://' + connection.domain;

  let xml;
  try {
    xml = await fetchText(base + '/sitemap.xml');
  } catch (e) {
    throw new Error('Could not fetch sitemap: ' + e.message);
  }

  let urls = parseSitemapUrls(xml);

  if (isSitemapIndex(xml)) {
    const nestedUrls = [];
    for (const nestedSitemapUrl of urls.filter(u => u.endsWith('.xml'))) {
      try {
        const nestedXml = await fetchText(nestedSitemapUrl);
        nestedUrls.push(...parseSitemapUrls(nestedXml).filter(u => !u.endsWith('.xml')));
      } catch { /* skip unreachable nested sitemap */ }
    }
    urls = nestedUrls;
  } else {
    urls = urls.filter(u => !u.endsWith('.xml'));
  }

  const allowed = connection.allowedPaths || [];
  const blocked = connection.blockedPaths || [];

  return urls.filter(url => {
    try {
      const path = new URL(url).pathname;
      if (blocked.some(p => path.startsWith(p))) return false;
      if (allowed.length > 0 && !allowed.some(p => path.startsWith(p))) return false;
      return true;
    } catch {
      return false;
    }
  });
}

async function createBlockedRecord(url, syncRunId, connectionId, policy, source) {
  const sl = await strapi.entityService.create('api::source-listing.source-listing', {
    data: {
      sourceConnection: connectionId,
      sourceUrl: url,
      importStatus: 'blocked',
      reviewStatus: 'rejected',
      blockedByPolicy: true,
      blockReasonCode: policy.reasonCode,
      candidateInventoryType: 'short_term',
      classifierVersion: '1.0',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      policyDecisionAt: new Date(),
    },
  });

  await strapi.entityService.create('api::policy-block-event.policy-block-event', {
    data: {
      sourceConnection: connectionId,
      sourceListing: sl.id,
      sourceUrl: url,
      candidateInventoryType: 'short_term',
      blockReasonCode: policy.reasonCode,
      classifierOutputJson: { method: source, confidence: policy.confidence },
      actionTaken: 'auto_blocked',
    },
  });

  await strapi.entityService.create('api::sync-run-item.sync-run-item', {
    data: {
      syncRun: syncRunId,
      sourceListing: sl.id,
      action: 'blocked',
      status: 'blocked_by_policy',
      policyReasonCode: policy.reasonCode,
    },
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/**
 * Sprint 41A: Duplicate detection — check if a similar CanonicalListing already exists.
 * Match: same addressLine1 (normalized) + price within 5%.
 * Returns a warning string or null.
 */
async function checkDuplicate(fields) {
  if (!fields.address) return null;
  const normalizedAddress = fields.address.trim().toLowerCase();
  const priceMinor = fields.priceMinor ? Number(fields.priceMinor) : null;
  try {
    const candidates = await strapi.entityService.findMany(
      'api::canonical-listing.canonical-listing',
      { filters: { status: { $ne: 'suppressed' } }, fields: ['title', 'slug', 'addressLine1', 'priceMinor'], limit: 200 }
    );
    for (const c of candidates) {
      if (!c.addressLine1) continue;
      if (c.addressLine1.trim().toLowerCase() !== normalizedAddress) continue;
      if (priceMinor && c.priceMinor) {
        const diff = Math.abs(priceMinor - c.priceMinor) / c.priceMinor;
        if (diff > 0.05) continue;
      }
      return `Similar listing exists: ${c.title} (${c.slug})`;
    }
  } catch { /* non-blocking */ }
  return null;
}

/**
 * Sprint 41A: Post-sync stale reconciliation.
 * SourceListings whose sourceUrl was not in the current crawl get their
 * CanonicalListing suppressed + freshnessStatus=stale.
 */
async function staleReconciliation(connectionId, discoveredUrlSet) {
  try {
    const sourceListings = await strapi.entityService.findMany(
      'api::source-listing.source-listing',
      { filters: { sourceConnection: connectionId, reviewStatus: 'approved' }, populate: ['canonicalListing'], limit: 2000 }
    );
    for (const sl of sourceListings) {
      if (!sl.sourceUrl || discoveredUrlSet.has(sl.sourceUrl)) continue;
      const canonical = sl.canonicalListing;
      if (!canonical?.id) continue;
      try {
        await strapi.entityService.update('api::canonical-listing.canonical-listing', canonical.id, {
          data: { status: 'suppressed', freshnessStatus: 'stale' },
        });
      } catch { /* skip */ }
      try {
        await strapi.entityService.create('api::policy-block-event.policy-block-event', {
          data: {
            sourceConnection: connectionId,
            sourceListing: sl.id,
            sourceUrl: sl.sourceUrl,
            blockReasonCode: 'source_removed',
            classifierOutputJson: { reason: 'URL not found in current sitemap crawl' },
            actionTaken: 'suppressed',
          },
        });
      } catch { /* skip */ }
      try {
        const conn = await strapi.entityService.findOne('api::source-connection.source-connection', connectionId, { populate: ['owner'] });
        const ownerEmail = conn?.owner?.email;
        const resendKey = process.env.RESEND_API_KEY;
        const fromEmail = legacySyncSender(process.env);
        if (ownerEmail && resendKey && fromEmail) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: fromEmail,
              to: ownerEmail,
              subject: 'A listing was suppressed: source page no longer available',
              html: `<p>Hi,</p><p>The following listing was suppressed because its source page is no longer available:<br/><strong>${canonical.title || 'Untitled'}</strong><br/>${sl.sourceUrl}</p>`,
            }),
          });
        }
      } catch { /* non-blocking */ }
    }
  } catch (e) {
    strapi.log.warn('[sync] stale reconciliation error: ' + e.message);
  }
}

async function createCanonicalListing(fields, connection) {
  if (!fields.title) return null;
  const slug = slugify(fields.title) + '-' + Math.random().toString(36).slice(2, 7);
  return strapi.entityService.create('api::canonical-listing.canonical-listing', {
    data: {
      title: fields.title,
      slug,
      description: fields.description || null,
      priceDisplay: fields.priceDisplay || null,
      priceMinor: fields.priceMinor || null,
      currency: 'BBD',
      bedrooms: fields.bedrooms || null,
      bathrooms: fields.bathrooms || null,
      addressLine1: fields.address || null,
      transactionType: fields.transactionType || 'for_sale',
      propertyCategory: fields.propertyCategory || 'residential',
      inventoryMode: 'imported_unclaimed',
      inventoryOriginType: 'imported',
      inventoryPolicyStatus: 'allowed',
      status: 'draft',
      sourceUrl: fields.sourceUrl || null,
      sourceDomain: connection.domain,
      sourceLabel: connection.domain,
      ownerAgency: connection.agency ? connection.agency.id : null,
      lastSyncedAt: new Date(),
    },
  });
}

async function runSync(connectionId) {
  const connection = await strapi.entityService.findOne(
    'api::source-connection.source-connection',
    connectionId,
    { populate: ['owner', 'agency'] }
  );
  if (!connection) throw new Error('Source connection not found');

  const enforcePolicy = connection.blockShortTermImports !== false;

  const syncRun = await strapi.entityService.create('api::sync-run.sync-run', {
    data: {
      sourceConnection: connectionId,
      status: 'running',
      startedAt: new Date(),
    },
  });

  let pagesScanned = 0;
  let listingsCreated = 0;
  let listingsUpdated = 0;
  let shortTermBlocked = 0;
  const errors = [];

  try {
    const urls = await collectListingUrls(connection);
    pagesScanned = urls.length;
    const discoveredUrlSet = new Set(urls);

    for (const url of urls) {
      try {
        const urlPolicy = classifyUrl(url, enforcePolicy);
        if (urlPolicy.decision === 'block_short_term') {
          shortTermBlocked++;
          await createBlockedRecord(url, syncRun.id, connectionId, urlPolicy, 'url_pattern');
          continue;
        }

        let html;
        try {
          html = await fetchText(url);
        } catch {
          continue;
        }

        const contentPolicy = classifyContent(html, enforcePolicy);
        if (contentPolicy.decision === 'block_short_term') {
          shortTermBlocked++;
          await createBlockedRecord(url, syncRun.id, connectionId, contentPolicy, 'content_keywords');
          continue;
        }

        const fields = extractFields(html, url);
        if (!fields.title) continue;

        const existing = await strapi.entityService.findMany('api::source-listing.source-listing', {
          filters: { sourceConnection: connectionId, sourceUrl: url },
          limit: 1,
        });

        let sl;
        let action;

        if (existing.length > 0) {
          sl = await strapi.entityService.update('api::source-listing.source-listing', existing[0].id, {
            data: { rawPayloadJson: fields, lastSeenAt: new Date(), importStatus: 'accepted' },
          });
          action = 'updated';
          listingsUpdated++;
        } else {
          // Sprint 41B: Duplicate detection before creating SourceListing
          const dupWarning = await checkDuplicate(fields);

          // New SourceListing lands as pending_review. CanonicalListing is NOT created here.
          // Agent must approve via /dashboard/imports/[id]/review.
          sl = await strapi.entityService.create('api::source-listing.source-listing', {
            data: {
              sourceConnection: connectionId,
              sourceUrl: url,
              rawPayloadJson: fields,
              importStatus: 'accepted',
              reviewStatus: 'pending_review',
              blockedByPolicy: false,
              candidateInventoryType: 'non_short_term',
              classifierVersion: '1.0',
              firstSeenAt: new Date(),
              lastSeenAt: new Date(),
              policyDecisionAt: new Date(),
              confidenceScore: fields.confidence || 0.8,
              ...(dupWarning ? { duplicateWarning: dupWarning } : {}),
            },
          });
          action = 'created';
          listingsCreated++;
        }

        await strapi.entityService.create('api::sync-run-item.sync-run-item', {
          data: {
            syncRun: syncRun.id,
            sourceListing: sl.id,
            action,
            status: action,
            confidenceScore: fields.confidence || 0.8,
          },
        });
      } catch (e) {
        errors.push({ url, error: e.message });
      }
    }

    // Sprint 41A: Post-sync stale reconciliation
    await staleReconciliation(connectionId, discoveredUrlSet);

    const finalStatus = shortTermBlocked > 0 || errors.length > 0
      ? 'completed_with_warnings'
      : 'completed';

    await strapi.entityService.update('api::sync-run.sync-run', syncRun.id, {
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        pagesScanned,
        listingsCreated,
        listingsUpdated,
        shortTermCandidatesDetected: shortTermBlocked,
        shortTermCandidatesBlocked: shortTermBlocked,
        policyBlockCount: shortTermBlocked,
        errorsJson: errors.length > 0 ? errors : null,
      },
    });

    await strapi.entityService.update('api::source-connection.source-connection', connectionId, {
      data: { syncStatus: 'success', lastSyncAt: new Date(), lastSuccessfulSyncAt: new Date() },
    });

    return { syncRunId: syncRun.id, status: finalStatus, listingsCreated, listingsUpdated, shortTermBlocked };
  } catch (e) {
    await strapi.entityService.update('api::sync-run.sync-run', syncRun.id, {
      data: { status: 'failed', finishedAt: new Date(), errorsJson: [{ error: e.message }] },
    });
    await strapi.entityService.update('api::source-connection.source-connection', connectionId, {
      data: { syncStatus: 'failed', lastErrorAt: new Date() },
    });
    throw e;
  }
}

module.exports = { runSync, createCanonicalListing };
