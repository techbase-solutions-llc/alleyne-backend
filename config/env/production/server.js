module.exports = ({ env }) => ({
  url: env("PUBLIC_URL"),
  // Behind Render's proxy: take the client address from X-Forwarded-For (auth rate limits),
  // only from the hop Render added (src/utils/client-ip.js, set in register; review, 8 Oct).
  proxy: true,
});
