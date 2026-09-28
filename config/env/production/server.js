module.exports = ({ env }) => ({
  url: env("PUBLIC_URL"),
  // Behind Render's proxy: take the client address from X-Forwarded-For (auth rate limits).
  proxy: true,
});
