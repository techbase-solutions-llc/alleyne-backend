module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        // jsonTransport: no network calls, no SMTP server required.
        // Emails are silently swallowed (logged as JSON internally).
        // Replace with a real SMTP/Resend config when the domain is live.
        jsonTransport: true,
      },
      settings: {
        defaultFrom: "noreply@realtlist.com",
        defaultReplyTo: "noreply@realtlist.com",
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
