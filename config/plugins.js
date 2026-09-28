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
  upload: {
    config: {
      provider: "cloudinary",
      providerOptions: {
        cloud_name: env("CLOUDINARY_NAME"),
        api_key: env("CLOUDINARY_KEY"),
        api_secret: env("CLOUDINARY_SECRET"),
      },
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
