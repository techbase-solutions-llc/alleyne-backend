"use strict";

// Strapi 4 upload provider for Vercel Blob (TEC-1344).
//
// Media library uploads go to the same public Blob store that holds the migrated listing
// photos, under their own "strapi/" prefix. The migration wrote listings/<slug>/NNN.webp with
// overwriting allowed, so nothing here may ever write inside listings/. Each object is named
// strapi/<Strapi hash><ext> plus a random suffix added by Blob: every upload (including a
// "replace" in the media library, which keeps the Strapi hash) gets a new URL, so there are
// no collisions and no stale cached copies.

const { put, del } = require("@vercel/blob");
const { errors: { ApplicationError } } = require("@strapi/utils");

const PREFIX = "strapi";

function objectKey(file) {
  return `${PREFIX}/${file.hash}${file.ext || ""}`;
}

module.exports = {
  init(providerOptions = {}) {
    const { token, cacheControlMaxAge } = providerOptions;

    // Checked per call rather than at boot, so a missing token breaks uploads with a clear
    // message instead of stopping Strapi from starting.
    const requireToken = () => {
      if (!token) {
        // ApplicationError: the admin shows this message instead of a bare 500.
        throw new ApplicationError("Photo uploads are not set up on this server (BLOB_READ_WRITE_TOKEN is missing).");
      }
      return token;
    };

    const send = async (file, body) => {
      const options = {
        access: "public",
        token: requireToken(),
        contentType: file.mime,
        addRandomSuffix: true,
      };
      if (cacheControlMaxAge) options.cacheControlMaxAge = cacheControlMaxAge;
      const blob = await put(objectKey(file), body, options);
      file.url = blob.url;
    };

    return {
      // Read the stream into memory first: Blob retries a failed upload by sending the same
      // body again, and a stream can only be read once (review, 28 Sep). Photos are at most
      // 20 MB (strapi::body limit), so this is cheap.
      async uploadStream(file) {
        const chunks = [];
        for await (const chunk of file.stream) chunks.push(chunk);
        return send(file, Buffer.concat(chunks));
      },
      upload(file) {
        return send(file, file.buffer);
      },
      async delete(file) {
        if (!file || !file.url) return;
        // Only ever delete what this provider wrote (strapi/): the same store holds the
        // migrated listing photos under listings/.
        let key = "";
        try { key = new URL(file.url).pathname; } catch { return; }
        if (!key.startsWith(`/${PREFIX}/`)) return;
        await del(file.url, { token: requireToken() });
      },
      isPrivate() {
        return false;
      },
    };
  },
};
