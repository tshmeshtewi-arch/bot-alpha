const {
  Events, EmbedBuilder, AuditLogEvent, PermissionsBitField
} = require('discord.js');
const { Database } = require('st.db');
const protectDB = new Database('/Json-db/Bots/protectDB.json');
const moment = require('moment');

const PROTECTIONS = [
  { key: 'botjoin',        event: null, name: 'حماية دخول البوتات' },       // معالجة في index.js
  { key: 'botunverified',  event: null, name: 'حماية دخول البوتات غير الموثوقة' },
  { key: 'ban',            event: AuditLogEvent.MemberBanAdd,   name: 'حماية حظر الأعضاء' },
  { key: 'kick',           event: AuditLogEvent.MemberKick,     name: 'حماية طرد الأعضاء' },
  { key: 'channelRename',  event: AuditLogEvent.ChannelUpdate,  name: 'حماية تغيير أسماء الشاتات' },
  { key: 'channelDelete',  event: AuditLogEvent.ChannelDelete,  name: 'حماية مسح الشاتات' },
  { key: 'roleAdd',        event: AuditLogEvent.RoleCreate,     name: 'حماية إضافة رتب' },
  { key: 'serverUpdate',   event: AuditLogEvent.GuildUpdate,    name: 'حماية تغيير معلومات السيرفر' }
];

function getSupportRoles(guildId) {
  const raw = protectDB.get(`support_roles_${guildId}`);
  return raw ? raw.split(',') : [];
}

function getPunishment(guildId, key) {
  return protectDB.get(`punishment_${key}_${guildId}`) || 'strip';
}

function getAlertChannel(guildId, key) {
  return protectDB.get(`alert_${key}_${guildId}`) || protectDB.get(`protectLog_room_${guildId}`);
}

function getEnabled(guildId, key) {
  return protectDB.get(`status_${key}_${guildId}`) === 'on';
}

async function sendAlert(guild, key, name, executor, target, punishment) {
  const chId = getAlertChannel(guild.id, key);
  const ch = guild.channels.cache.get(chId);
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setTitle('🛡️ نظام الحماية')
    .setColor('#ef4444')
    .addFields(
      { name: 'الحماية', value: name },
      { name: 'المنفذ', value: executor ? `${executor.tag || executor} \`${executor.id}\`` : 'غير معروف' },
      { name: 'الهدف', value: target || '—' },
      { name: 'العقوبة', value: punishment === 'ban' ? '🔨 حظر' : '🏷️ سحب الرتب' }
    )
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

async function punish(guild, executor, guildId, key, name, target) {
  if (!executor || executor.bot) return;
  if (executor.id === guild.ownerId) return;
  const supportRoles = getSupportRoles(guildId);
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return;
  if (member.roles.cache.some(r => supportRoles.includes(r.id))) return; // رتب الدعم محمية

  const punishment = getPunishment(guildId, key);
  await sendAlert(guild, key, name, executor, target, punishment);

  try {
    if (punishment === 'ban') await member.ban({ reason: `UniBot: ${name}` });
    else {
      await member.roles.set([], `UniBot: ${name}`);
    }
  } catch (e) { console.error('punish error:', e.message); }
}

module.exports = (client) => {
  // حماية دخول البوتات غير الموثوقة
  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.user.bot) return;
    if (!getEnabled(member.guild.id, 'botunverified')) return;
    if (member.user.flags?.has('VerifiedBot') || member.user.verified) return;
    const logRoom = getAlertChannel(member.guild.id, 'botunverified');
    const ch = member.guild.channels.cache.get(logRoom);
    if (ch) ch.send({ embeds: [new EmbedBuilder()
      .setTitle('🛡️ حماية البوتات غير الموثوقة')
      .setColor('#a855f7')
      .setDescription(`تم طرد البوت غير الموثوق: ${member.user.tag}`)
    ]}).catch(() => {});
    await member.kick('UniBot: unverified bot').catch(() => {});
  });

  // الحمايات المعتمدة على Audit Log
  for (const p of PROTECTIONS.filter(x => x.event !== null)) {
    client.on(Events[p.event.replace(/([A-Z])/g, '')], async (...args) => {
      // نجيب الحدث الصحيح
    });
  }

  const eventsMap = {
    [AuditLogEvent.MemberBanAdd]: Events.GuildBanAdd,
    [AuditLogEvent.MemberKick]: Events.GuildMemberRemove,
    [AuditLogEvent.ChannelUpdate]: Events.ChannelUpdate,
    [AuditLogEvent.ChannelDelete]: Events.ChannelDelete,
    [AuditLogEvent.RoleCreate]: Events.GuildRoleCreate,
    [AuditLogEvent.GuildUpdate]: Events.GuildUpdate
  };

  for (const p of PROTECTIONS.filter(x => x.event !== null)) {
    const discordEvent = eventsMap[p.event];
    if (!discordEvent) continue;

    client.on(discordEvent, async (arg1, arg2) => {
      const guild = arg1.guild || arg1;
      if (!guild) return;
      if (!getEnabled(guild.id, p.key)) return;

      const logs = await guild.fetchAuditLogs({ limit: 1, type: p.event }).catch(() => null);
      const entry = logs?.entries.first();
      if (!entry) return;
      if (Date.now() - entry.createdTimestamp > 10000) return;

      let target = '';
      if (p.key === 'channelRename' && arg2) {
        if (arg1.name === arg2.name) return; // ما تغير الاسم
        target = `#${arg2.name} → #${arg1.name}`;
      }
      else if (p.key === 'channelDelete') target = `#${arg1.name}`;
      else if (p.key === 'roleAdd') target = `@${arg1.name}`;
      else if (p.key === 'serverUpdate') target = 'إعدادات السيرفر';
      else if (p.key === 'ban') target = `${arg1.user?.tag || ''}`;
      else if (p.key === 'kick') target = `${arg1.user?.tag || arg1.tag || ''}`;

      await punish(guild, entry.executor, guild.id, p.key, p.name, target);
    });
  }
};

// التصدير إضافي لأدوات الحماية (الداشبورد يستخدمها)
module.exports.supportRoles = getSupportRoles;
module.exports.isEnabled = getEnabled;
