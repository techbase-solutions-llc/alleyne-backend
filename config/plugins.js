module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "nodemailer",
      // Resend over SMTP when a key is set (password reset, email confirmation; TEC-1344);
      // otherwise emails are swallowed (local development). The sender comes from
      // EMAIL_FROM, so the jalbarbados.com address at cutover is a settings change.
      providerOptions: env("RESEND_API_KEY")
        ? { host: "smtp.resend.com", port: 465, secure: true, auth: { user: "resend", pass: env("RESEND_API_KEY") } }
        : { jsonTransport: true },
      settings: {
        defaultFrom: env("EMAIL_FROM", "Alleyne Real Estate <noreply@example.com>"),
        defaultReplyTo: env("EMAIL_REPLY_TO", "info@jalbarbados.com"),
      },
    },
  },
  "strapi-plugin-populate-deep": {
    config: {
      defaultDepth: 5,
    },
  },
  // Media library files go to Vercel Blob, the same public store as the migrated listing
  // photos, under strapi/ (local provider in providers/; TEC-1344). Cloudinary was never
  // configured on Render, so every upload failed.
  upload: {
    config: {
      provider: "strapi-provider-upload-vercel-blob",
      providerOptions: {
        token: env("BLOB_READ_WRITE_TOKEN"),
      },
      sizeLimit: 20 * 1024 * 1024, // 20 MB per file, plenty for listing photos
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
  // GraphQL off (TEC-1343 second review): the site never uses it, and its shadow-CRUD
  // resolvers skip the custom REST controllers, so a signed-in client could read, edit and
  // delete every user's saved searches and favourites through it (verified on production).
  graphql: {
    enabled: false,
    config: {
      endpoint: "/graphql",
      shadowCRUD: true,
      playgroundAlways: false,
      depthLimit: 15,
      amountLimit: 100,
      apolloServer: {
        tracing: false,
      },
    },
  },
});
