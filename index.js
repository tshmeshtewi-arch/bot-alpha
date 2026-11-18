const {
  Client, Collection, GatewayIntentBits, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, PermissionsBitField, Events, ChannelType, REST, Routes, MessageFlags
} = require('discord.js');
const moment = require('moment');
const ms = require('ms');
const path = require('path');
const { readdirSync } = require("fs");
const { Database } = require("st.db");

// ====== تعريف كافة قواعد البيانات بدون أي نقص ======
const taxDB = new Database("/Json-db/Bots/taxDB.json");
const autolineDB = new Database("/Json-db/Bots/autolineDB.json");
const suggestionsDB = new Database("/Json-db/Bots/suggestionsDB.json");
const feedbackDB = new Database("/Json-db/Bots/feedbackDB.json");
const giveawayDB = new Database("/Json-db/Bots/giveawayDB.json");
const systemDB = new Database("/Json-db/Bots/systemDB.json");
const welcomeDB = new Database("/Json-db/Bots/systemDB.json");
const autorankDB = new Database("/Json-db/Bots/autorankDB.json");
const levelsDB = new Database("/Json-db/Bots/levelsDB.json");
const presentDB = new Database("/Json-db/Bots/presentDB.json");
const gamesDB = new Database("/Json-db/Bots/gamesDB.json");
const shortcutDB = new Database("/Json-db/Others/shortcutDB.json");
const protectDB = new Database("/Json-db/Bots/protectDB.json");
const db = new Database("/Json-db/Bots/BroadcastDB");
const logsDB = new Database("/Json-db/Bots/logsDB.json");
const nadekoDB = new Database("/Json-db/Bots/nadekoDB.json");
const one4allDB = new Database("/Json-db/Bots/one4allDB.json");
const ticketDB = new Database("/Json-db/Bots/ticketDB.json");
const walletDB = new Database("/Json-db/Bots/walletDB.json");
const autoreplyDB = new Database("/Json-db/Bots/autoreplyDB.json");
const embedsDB = new Database("/Json-db/Bots/embedsDB.json");

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const { token, clientId, owner, prefix } = require('./config.js');

const client27 = new Client({
  intents: 131071,
  shards: "auto",
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client27.commands = new Collection();
client27.events = new Collection();
client27.one4allSlashCommands = new Collection();
client27.setMaxListeners(1000);

const rest = new REST({ version: '10' }).setToken(token);

// ====== تحميل الأوامر وتجنب أي تكرار (Duplicate Names) ======
const folderPath = path.join(__dirname, 'slashcommand27');
const commandsMap = new Map();

// إضافة الأوامر الأساسية أولاً
commandsMap.set('help', { name: 'help', description: 'عرض قائمة المساعدة والأوامر الشاملة' });
commandsMap.set('ping', { name: 'ping', description: 'معرفة سرعة استجابة البوت' });
commandsMap.set('balance', { name: 'balance', description: 'معرفة رصيدك الحالي من عملة Ly والمحفظة' });

try {
  for (let folder of readdirSync(folderPath).filter(f => !f.includes("."))) {
    for (let file of readdirSync(`${folderPath}/${folder}`).filter(f => f.endsWith(".js"))) {
      let command = require(`${folderPath}/${folder}/${file}`);
      if (command && command.data && command.data.name) {
        commandsMap.set(command.data.name, command.data.toJSON());
        client27.one4allSlashCommands.set(command.data.name, command);
      }
    }
  }
} catch (e) {}

const finalSlashCommands = Array.from(commandsMap.values());

client27.once('clientReady', async () => {
  try {
    await rest.put(Routes.applicationCommands(clientId || client27.user.id), { body: finalSlashCommands });
    console.log(`✅ تم تسجيل الأوامر الفريدة بنجاح في ديسكورد بدون تكرار!`);
  } catch (error) {
    console.error("❌ خطأ تسجيل الأوامر:", error);
  }
  console.log(`🟢 UniBot online — ${client27.user.tag}`);
});

try { require(`./handlers/events`)(client27); } catch(e){}
try { require("./handlers/suggest")(client27); } catch(e){}
try { require('./handlers/tax4bot')(client27); } catch(e){}
try { require("./handlers/autorole")(client27); } catch(e){}

client27.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.user.bot) return;
    const { commandName } = interaction;
    
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) })
        .setTitle('قائمة اوامر UniBot الاحترافية')
        .setDescription('اختر القسم المطلوب من الأزرار أو استخدم لوحة التحكم المباشرة:')
        .setColor('#a855f7');
      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }
    if (commandName === 'ping') {
      return interaction.reply({ content: `🏓 Pong! السرعة: ${Math.round(client27.ws.ping)}ms`, flags: [MessageFlags.Ephemeral] });
    }
    if (commandName === 'balance') {
      const userId = interaction.user.id;
      const guildWallets = walletDB.get(interaction.guild.id) || {};
      const userBalance = guildWallets[userId] !== undefined ? guildWallets[userId] : 150;
      return interaction.reply({ content: `💰 رصيدك الحالي في المحفظة هو: **${userBalance} Ly**`, flags: [MessageFlags.Ephemeral] });
    }

    const command = client27.one4allSlashCommands.get(commandName);
    if (command) {
      try {
        await command.execute(interaction);
      } catch (error) {
        console.log("🔴 خطأ في تنفيذ الأمر:", error);
      }
    }
  }

  if (interaction.isButton() && interaction.customId === 'create_ticket') {
    await createTicketChannel(interaction);
  }
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket') {
    await createTicketChannel(interaction);
  }
});

async function createTicketChannel(interaction) {
  const guild = interaction.guild;
  const ticketData = ticketDB.get(guild.id) || {};
  try {
    const categoryId = ticketData.ticketCategory;
    const supportRole = ticketData.ticketSupportRole;
    const welcomeTicketMsg = ticketData.ticketWelcomeMsg || "مرحباً بك، سيتم خدمتك قريباً.";

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: categoryId || null,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ...(supportRole ? [{ id: supportRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
      ]
    });

    await channel.send({ content: `<@${interaction.user.id}> ${welcomeTicketMsg}` });
    await interaction.reply({ content: `✅ تم إنشاء تذكرتك بنجاح: ${channel}`, flags: [MessageFlags.Ephemeral] });
  } catch (e) {
    await interaction.reply({ content: `❌ حدث خطأ أثناء إنشاء التذكرة.`, flags: [MessageFlags.Ephemeral] });
  }
}

// ====== لوحة التحكم (Dashboard API) ======
const sessions = new Map();
const app = express();
app.use(cors());
app.use(express.json());

async function discordFetch(url, token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

app.post('/api/auth/callback', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code) return res.status(400).json({ error: 'no code' });

  const r = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID || client27.user.id,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect_uri,
    })
  });
  const tokenData = await r.json();
  if (!tokenData.access_token) return res.status(401).json({ error: 'bad code' });

  const me = await discordFetch('https://discord.com/api/v10/users/@me', tokenData.access_token);
  const sToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sToken, { userId: me.id, discordToken: tokenData.access_token, username: me.username, avatar: me.avatar, expires: Date.now() + 7*24*60*60*1000 });
  res.json({ token: sToken, user: { id: me.id, username: me.username, avatar: me.avatar } });
});

app.get('/api/my-guilds', async (req, res) => {
  const s = sessions.get(req.headers['x-session']);
  if (!s || s.expires < Date.now()) return res.status(401).json({ error: 'expired' });

  const userGuilds = await discordFetch('https://discord.com/api/v10/users/@me/guilds', s.discordToken);
  if (!Array.isArray(userGuilds)) return res.status(401).json({ error: 'discord error' });

  const result = [];
  for (const g of userGuilds) {
    const perms = BigInt(g.permissions || 0);
    if (!g.owner && (perms & PermissionsBitField.Flags.Administrator) !== PermissionsBitField.Flags.Administrator) continue;
    const botGuild = client27.guilds.cache.get(g.id);
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
  const guild = client27.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json({ error: 'bot not in server' });
  try {
    const member = await guild.members.fetch(s.userId);
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return res.status(403).json({ error: 'not admin' });
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

  const session = sessions.get(req.headers['x-session']);
  const userWallets = walletDB.get(g.id) || {};
  const userBalance = session && userWallets[session.userId] !== undefined ? userWallets[session.userId] : 150;

  res.json({
    channels,
    roles,
    wallet: { balance: userBalance },
    settings: {
      overview: systemDB.get(g.id) || {},
      settings: systemDB.get(g.id) || {},
      welcome: welcomeDB.get(g.id) || {},
      autorank: autorankDB.get(g.id) || {},
      tickets: ticketDB.get(g.id) || {},
      protect: protectDB.get(g.id) || {},
      levels: levelsDB.get(g.id) || {},
      present: presentDB.get(g.id) || {},
      games: gamesDB.get(g.id) || {},
      autoreply: autoreplyDB.get(g.id) || {},
      embeds: embedsDB.get(g.id) || {},
      broadcasts: systemDB.get(g.id) || {}
    }
  });
});

const DBS = { 
  overview: systemDB, settings: systemDB, welcome: welcomeDB, autorank: autorankDB,
  tickets: ticketDB, protect: protectDB, levels: levelsDB, present: presentDB, 
  games: gamesDB, wallet: walletDB, autoreply: autoreplyDB, embeds: embedsDB, broadcasts: systemDB
};

app.post('/api/settings/:guildId/:system', requireGuildAdmin, (req, res) => {
  const db = DBS[req.params.system];
  if (!db) return res.status(400).json({ error: 'unknown system' });
  const oldData = db.get(req.params.guildId) || {};
  db.set(req.params.guildId, { ...oldData, ...req.body });
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  res.json({
    servers: client27.guilds.cache.size,
    users: client27.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    ping: Math.round(client27.ws.ping),
    uptime: Math.floor((Date.now() - bootTime) / 1000),
    status: client27.ws.status === 0 ? 'online' : 'offline'
  });
});

const PORT = process.env.SERVER_PORT || process.env.PORT || 7050;
app.listen(PORT, '0.0.0.0', () => console.log(`🖥️ Dashboard API on port ${PORT}`));

const bootTime = Date.now();
client27.login(token);
