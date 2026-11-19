require('dotenv').config();

module.exports = {
  token: process.env.TOKEN || (() => {
    console.error("❌ TOKEN is not set. Add it in the panel's Env tab - never in a file.");
    return "";
  })(),
  prefix: process.env.PREFIX || "!",
  owner: process.env.OWNER_ID || "1274111498980954124",
  clientId: process.env.CLIENT_ID || "",
  ytCookie: process.env.YT_COOKIE || "",
  dashboardPort: process.env.DASH_PORT || 3000
};
