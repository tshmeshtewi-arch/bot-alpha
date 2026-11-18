// dashboard-api.js
const express = require('express');
const cors = require('cors');
const { PermissionsBitField, ChannelType } = require('discord.js');
const { Database } = require('st.db');
const crypto = require('crypto');

const systemDB   = new Database('/Json-db/Bots/systemDB.json');
const protectDB  = new Database('/Json-db/Bots/protectDB.json');
const ticketDB   = new Database('/Json-db/Bots/ticketDB.json');
const welcomeDB  = new Database('/Json-db/Bots/systemDB.json');
const autorankDB = new Database('/Json-db/Bots/autorankDB.json');
const levelsDB   = new Database('/Json-db/Bots/levelsDB.json');
const presentDB  = new Database('/Json-db/Bots/presentDB.json');
const gamesDB    = new Database('/Json-db/Bots/gamesDB.json');

const DBS = { 
  protection: protectDB, 
  tickets: ticketDB, 
  system: systemDB, 
  welcome: welcomeDB, 
  autorank: autorankDB,
  levels: levelsDB,
  present: presentDB,
  games: gamesDB,
  settings: systemDB 
};

const sessions = new Map();

async function discordFetch(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function createSession(discordToken) {
  const me = await discordFetch('https://discord.com/api/v10/users/@me', discordToken);
  if (!me.id) return null;
  const sToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sToken, {
    userId: me.id,
    discordToken,
    username: me.username,
    avatar: me.avatar,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  return { token: sToken, user: { id: me.id, username: me.username, avatar: me.avatar } };
}

module.exports = (client) => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/api/auth/callback', async (req, res) => {
    const { code, redirect_uri } = req.body;
    if (!code) return res.status(400).json({ error: 'no code' });

    const r = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID || client.user.id,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri || process.env.OAUTH_REDIRECT,
      })
    });
    const tokenData = await r.json();
    if (!tokenData.access_token) return res.status(401).json({ error: 'bad code', detail: tokenData });

    const session = await createSession(tokenData.access_token);
    if (!session) return res.status(401).json({ error: 'session failed' });
    res.json(session);
  });

  app.get('/api/my-guilds', async (req, res) => {
    const s = sessions.get(req.headers['x-session']);
    if (!s || s.expires < Date.now()) return res.status(401).json({ error: 'expired' });

    const userGuilds = await discordFetch('https://discord.com/api/v10/users/@me/guilds', s.discordToken);
    if (!Array.isArray(userGuilds)) return res.status(401).json({ error: 'discord error' });

    const result = [];
    for (const g of userGuilds) {
      const isOwner = g.owner;
      const perms = BigInt(g.permissions || 0);
      const isAdmin = (perms & PermissionsBitField.Flags.Administrator) === PermissionsBitField.Flags.Administrator;
      if (!isOwner && !isAdmin) continue;

      const botGuild = client.guilds.cache.get(g.id);
      if (!botGuild) continue;

      result.push({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null
      });
    }
    res.json({ user: { username: s.username, id: s.userId, avatar: s.avatar }, guilds: result });
  });

  async function requireGuildAdmin(req, res, next) {
    const s = sessions.get(req.headers['x-session']);
    if (!s || s.expires < Date.now()) return res.status(401).json({ error: 'expired' });
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'bot not in server' });
    try {
      const member = await guild.members.fetch(s.userId);
      if (!member.permissions.has(PermissionsBitField.Flags.Administrator))
        return res.status(403).json({ error: 'not admin' });
      req.guild = guild;
      next();
    } catch {
      return res.status(403).json({ error: 'not member' });
    }
  }

  app.get('/api/guild/:guildId/data', requireGuildAdmin, (req, res) => {
    const g = req.guild;
    const channels = g.channels.cache.map(c => ({ id: c.id, name: (c.type === ChannelType.GuildCategory ? '📁 ' : '#') + c.name, type: c.type }));
    const roles = g.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).map(r => ({ id: r.id, name: r.name }));

    res.json({
      channels,
      roles,
      settings: {
        system: systemDB.get(g.id) || {},
        protection: protectDB.get(g.id) || {},
        tickets: ticketDB.get(g.id) || {},
        welcome: welcomeDB.get(g.id) || {},
        autorank: autorankDB.get(g.id) || {},
        levels: levelsDB.get(g.id) || {},
        present: presentDB.get(g.id) || {},
        games: gamesDB.get(g.id) || {}
      }
    });
  });

  app.post('/api/settings/:guildId/:system', requireGuildAdmin, (req, res) => {
    const db = DBS[req.params.system];
    if (!db) return res.status(400).json({ error: 'unknown system' });
    const oldData = db.get(req.params.guildId) || {};
    db.set(req.params.guildId, { ...oldData, ...req.body });
    res.json({ ok: true });
  });

  app.get('/api/stats', (req, res) => {
    res.json({
      servers: client.guilds.cache.size,
      users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
      ping: Math.round(client.ws.ping),
      uptime: Math.floor(process.uptime()),
      status: client.ws.status === 0 ? 'online' : 'offline'
    });
  });

  const PORT = process.env.SERVER_PORT || process.env.PORT || 7050;
  app.listen(PORT, '0.0.0.0', () => console.log(`🖥️ Dashboard API على المنفذ ${PORT}`));
};
