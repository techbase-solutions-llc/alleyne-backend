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
        throw new Error("Vercel Blob upload provider: BLOB_READ_WRITE_TOKEN is not set.");
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
      uploadStream(file) {
        return send(file, file.stream);
      },
      upload(file) {
        return send(file, file.buffer);
      },
      async delete(file) {
        if (!file || !file.url) return;
        await del(file.url, { token: requireToken() });
      },
      isPrivate() {
        return false;
      },
    };
  },
};
