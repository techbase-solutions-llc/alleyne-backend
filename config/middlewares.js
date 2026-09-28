module.exports = [
  "strapi::logger",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          // *.public.blob.vercel-storage.com: media library files live on Vercel Blob
          // (TEC-1344). The "blob:" entry is the browser scheme for local previews, not that.
          "img-src": [
            "'self'",
            "data:",
            "blob:",
            "market-assets.strapi.io",
            "res.cloudinary.com",
            "*.public.blob.vercel-storage.com",
          ],
          "media-src": [
            "'self'",
            "data:",
            "blob:",
            "market-assets.strapi.io",
            "res.cloudinary.com",
            "*.public.blob.vercel-storage.com",
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  "strapi::errors",
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  // 20 MB per file, checked while the upload is read, for both new files and "replace"
  // (the upload plugin's own sizeLimit only runs after sharp has processed the file).
  { name: "strapi::body", config: { formidable: { maxFileSize: 20 * 1024 * 1024 } } },
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
