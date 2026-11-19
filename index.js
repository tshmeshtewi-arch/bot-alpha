const {
  Client, Collection, GatewayIntentBits, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionsBitField, Events, ChannelType,
  REST, Routes, MessageFlags, AuditLogEvent, ApplicationCommandOptionType
} = require('discord.js');
const path = require('path');
const { readdirSync } = require('fs');
const { Database } = require('st.db');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { token, clientId, prefix } = require('./config.js');

// ====== قواعد البيانات ======
const systemDB    = new Database('/Json-db/Bots/systemDB.json');
const autorankDB  = new Database('/Json-db/Bots/autorankDB.json');
const levelsDB    = new Database('/Json-db/Bots/levelsDB.json');
const presentDB   = new Database('/Json-db/Bots/presentDB.json');
const protectDB   = new Database('/Json-db/Bots/protectDB.json');
const ticketDB    = new Database('/Json-db/Bots/ticketDB.json');
const walletDB    = new Database('/Json-db/Bots/walletDB.json');
const autoreplyDB = new Database('/Json-db/Bots/autoreplyDB.json');
const embedsDB    = new Database('/Json-db/Bots/embedsDB.json');
const broadcastDB = new Database('/Json-db/Bots/BroadcastDB.json');

// ====== الأونر ======
const OWNER_ID = process.env.OWNER_ID || '';
const OWNER_ROLE_ID = '1570145261882187816';
function isOwnerMember(member) {
  if (OWNER_ID && member.id === OWNER_ID) return true;
  return member.roles?.cache?.has(OWNER_ROLE_ID) || false;
}

// ====== نظام اللغة (عربي / إنجليزي) ======
const T = {
  ar: {
    helpTitle: 'قائمة اوامر البوت',
    helpDesc: 'اختر القسم من الأزرار بالأسفل 👇',
    ownerOnly: '❌ هذا الأمر لرتبة الأونر فقط',
    balance: (b) => `💰 رصيدك الحالي: **${b} Ly**`,
    added: (a, m, n) => `✅ تم إضافة **${a} Ly** إلى ${m} — رصيده الآن: **${n} Ly**`,
    taken: (a, m, n) => `✅ تم سحب **${a} Ly** من ${m} — رصيده الآن: **${n} Ly**`,
    resetOne: (m) => `♻️ تم تصفير رصيد ${m}`,
    resetAll: (n) => `♻️ تم تصفير حسابات **${n}** عضو`,
    transferred: (a, m) => `💸 تم تحويل **${a} Ly** إلى ${m}`,
    noMoney: (b) => `❌ رصيدك غير كافٍ — رصيدك: **${b} Ly**`,
    selfTransfer: '❌ لا يمكنك التحويل لنفسك',
    botTransfer: '❌ لا يمكن التحويل لبوت',
    badAmount: '⚠️ المبلغ يجب أن يكون أكبر من صفر',
    ticketCreated: (c) => `✅ تم إنشاء تذكرتك: ${c}`,
    ticketError: '❌ حدث خطأ أثناء إنشاء التذكرة.',
    welcome: (m, s, c) => `أهلاً بك ${m} في ${s} — أنت العضو رقم ${c}`,
    transferLog: 'تحويل'
  },
  en: {
    helpTitle: 'Bot Commands List',
    helpDesc: 'Choose a section from the buttons below 👇',
    ownerOnly: '❌ This command is owner-only',
    balance: (b) => `💰 Your current balance: **${b} Ly**`,
    added: (a, m, n) => `✅ Added **${a} Ly** to ${m} — new balance: **${n} Ly**`,
    taken: (a, m, n) => `✅ Took **${a} Ly** from ${m} — new balance: **${n} Ly**`,
    resetOne: (m) => `♻️ Reset balance of ${m}`,
    resetAll: (n) => `♻️ Reset **${n}** accounts`,
    transferred: (a, m) => `💸 Transferred **${a} Ly** to ${m}`,
    noMoney: (b) => `❌ Not enough funds — your balance: **${b} Ly**`,
    selfTransfer: '❌ You cannot transfer to yourself',
    botTransfer: '❌ You cannot transfer to a bot',
    badAmount: '⚠️ Amount must be greater than zero',
    ticketCreated: (c) => `✅ Ticket created: ${c}`,
    ticketError: '❌ An error occurred while creating the ticket.',
    welcome: (m, s, c) => `Welcome ${m} to ${s} — you are member #${c}`,
    transferLog: 'Transfer'
  }
};
const lang = (gid) => systemDB.get(`settings_${gid}`)?.lang === 'en' ? 'en' : 'ar';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});
client.setMaxListeners(100);
client.commands = new Collection();

const bootTime = Date.now();
const rest = new REST({ version: '10' }).setToken(token);

// ══════════════ الأوامر الاقتصادية ══════════════
const EXTRA_COMMANDS = [
  { name: 'addmoney', description: 'إضافة رصيد لعضو — أوامر الدعم فقط',
    options: [
      { name: 'member', description: 'العضو', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ], ownerOnly: true },
  { name: 'resetbalance', description: 'تصفير رصيد عضو أو جميع الأعضاء — أوامر الدعم فقط',
    options: [
      { name: 'member', description: 'العضو (اتركه فارغاً لو اخترت all)', type: ApplicationCommandOptionType.User, required: false },
      { name: 'all', description: 'تصفير جميع الأعضاء؟', type: ApplicationCommandOptionType.Boolean, required: false }
    ], ownerOnly: true },
  { name: 'takebalance', description: 'سحب مبلغ من عضو — أوامر الدعم فقط',
    options: [
      { name: 'member', description: 'العضو', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ], ownerOnly: true },
  { name: 'transfer', description: 'تحويل رصيد من محفظتك لعضو آخر',
    options: [
      { name: 'member', description: 'العضو المستلم', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ], ownerOnly: false }
];

// ══════════════ أقسام /help ══════════════
const HELP_CATEGORIES = {
  help_tax: { label: 'ضريبة', emoji: '💰', cmds: [
    ['`/set-tax-room`', 'لتحديد روم الضريبة التلقائية'],
    ['`/set-tax-line`', 'لتحديد الخط'],
    ['`/tax-mode`', 'لتحديد شكل الضريبة'],
    ['`/tax` | `!tax`', 'لحساب ضريبة بروبوت اي مبلغ تريده']
  ]},
  help_autoline: { label: 'خط تلقائي', emoji: '🤖', cmds: [
    ['`/set-autoline-line`', 'لتحديد الخط'],
    ['`/add-autoline-channel`', 'لاضافة روم خط تلقائي'],
    ['`/remove-autoline-channel`', 'لازالة روم خط تلقائي'],
    ['`/line-mode`', 'تحديد طريقة ارسال الخط'],
    ['`خط` | `-`', 'لارسال خط']
  ]},
  help_suggestion: { label: 'اقتراحات', emoji: '💡', cmds: [
    ['`/set-suggestions-line`', 'لتحديد خط الاقتراحات'],
    ['`/set-suggestions-room`', 'لتحديد روم الاقتراحات'],
    ['`/suggestions-mode`', 'لتحديد شكل الاقتراحات']
  ]},
  help_feedback: { label: 'اراء', emoji: '💭', cmds: [
    ['`/set-feedback-line`', 'لتحديد خط الاراء'],
    ['`/set-feedback-room`', 'لتحديد روم الاراء'],
    ['`/feedback-mode`', 'امبد أو رياكشن فقط'],
    ['`/setup-rating`', 'لتسطيب نظام تقييم الاداريين'],
    ['`!تقييم`', 'طلب تقييم']
  ]},
  help_system: { label: 'سيستم', emoji: '⚙️', cmds: [
    ['`/avatar`', 'لرؤية افتارك او افتار شخص اخر'],
    ['`/server` | `!server`', 'لرؤية معلومات السيرفر'],
    ['`/user`', 'لرؤية معلومات حسابك او حساب شخص اخر'],
    ['`/banner`', 'لرؤية بانرك او بانر شخص اخر'],
    ['`/setup-welcome`', 'تسطيب نظام الترحيب'],
    ['`/ban`', 'لاعطاء باند لشخص او ازالته'],
    ['`/clear` | `!clear`', 'لحذف عدد من الرسائل'],
    ['`/kick`', 'لاعطاء طرد لشخص او ازالته'],
    ['`/lock` | `!lock`', 'لقفل روم'],
    ['`/mute`', 'لاعطاء ميوت لشخص او ازالته'],
    ['`/role`', 'لاعطاء رتبة لشخص او ازالتها'],
    ['`/say` | `!say`', 'لقول كلام'],
    ['`/timeout`', 'لاعطاء تايم اوت لشخص او ازالته']
  ]},
  help_ticket: { label: 'تكت', emoji: '🎫', cmds: [
    ['`/setup-ticket`', 'لانشاء تكت جديد'],
    ['`/add-ticket-button`', 'لاضافة زر للتكت'],
    ['`/to-select`', 'لتحويل التكت الى سلكت منيو'],
    ['`/set-ticket-log`', 'لتحديد رومات اللوغ'],
    ['`/add-user`', 'لاضافة شخص للتكت'],
    ['`/remove-user`', 'لازالة شخص من التكت'],
    ['`/rename`', 'لتغيير اسم التكت'],
    ['`/close` | `!close`', 'لاغلاق التكت'],
    ['`/delete` | `!delete`', 'لحذف التكت']
  ]},
  help_giveaway: { label: 'جيف اوي', emoji: '🎁', cmds: [
    ['`/gstart`', 'لبدا جيف اوي'],
    ['`/gend`', 'لانهاء جيف اوي'],
    ['`/greroll`', 'لاعادة الفائزين في جيف اوي']
  ]},
  help_protection: { label: 'حماية', emoji: '🛡️', cmds: [
    ['`/anti-ban`', 'لتسطيب نظام الحماية من الباند'],
    ['`/anti-bots`', 'لتسطيب نظام الحماية من البوتات'],
    ['`/anti-delete-roles`', 'لتسطيب نظام الحماية من حذف الرتب'],
    ['`/anti-delete-rooms`', 'لتسطيب نظام الحماية من حذف الرومات'],
    ['`/protection-status`', 'للاستعلام عن حالة الحماية'],
    ['`/set-protect-logs`', 'لتحديد روم لوج الحماية']
  ]},
  help_logs: { label: 'لوج', emoji: '📜', cmds: [
    ['`/logs-info`', 'لمعرفة معلومات نظام اللوج'],
    ['`/setup-logs`', 'لتسطيب نظام اللوج']
  ]},
  help_apply: { label: 'تقديمات', emoji: '📝', cmds: [
    ['`/setup-apply`', 'لتسطيب نظام التقديم'],
    ['`/new-apply`', 'لانشاء تقديم جديد'],
    ['`/dm-mode`', 'لارسال رسالة لخاص المتقدم عند الرفض او القبول'],
    ['`/close-apply`', 'لانهاء التقديم المفتوح']
  ]},
  help_broadcast: { label: 'برودكاست', emoji: '📢', cmds: [
    ['`/send-broadcast-panel`', 'ارسال بانل التحكم في البرودكاست'],
    ['`!obc`', 'لارسال رسالة للأعضاء الأونلاين'],
    ['`!bc`', 'ارسال رسالة للكل'],
    ['`/remove-token`', 'ازالة توكن محدد من بوتات البرودكاست'],
    ['`/remove-all-tokens`', 'ازالة جميع توكنات البرودكاست']
  ]},
  help_nadeko: { label: 'ناديكو', emoji: '⏳', cmds: [
    ['`/set-message`', 'لتحديد الرسالة عند الدخول'],
    ['`/add-nadeko-room`', 'لاضافة روم تُفعّل الخاصية فيها'],
    ['`/remove-nadeko-room`', 'لازالة روم مفعل الخاصية فيها']
  ]},
  help_autoreply: { label: 'رد تلقائي', emoji: '💎', cmds: [
    ['`/autoreply-add`', 'لاضافة رد تلقائي'],
    ['`/autoreply-remove`', 'لازالة رد تلقائي'],
    ['`/autoreply-list`', 'لرؤية جميع الردود']
  ]},
  help_autorole: { label: 'رتب تلقائية', emoji: '⚡', cmds: [
    ['`/new-panel`', 'انشاء بنل رتب جديد'],
    ['`/add-button`', 'اضافة زر جديد للرتبة']
  ]},
  help_support: { label: 'أوامر الدعم', emoji: '👑', cmds: [
    ['`/addmoney`', 'إضافة رصيد لعضو — للاونر فقط'],
    ['`/resetbalance`', 'تصفير رصيد عضو أو الجميع — للاونر فقط'],
    ['`/takebalance`', 'سحب مبلغ من عضو — للاونر فقط'],
    ['`/transfer`', 'تحويل رصيد لعضو آخر — للجميع'],
    ['`/balance` | `!balance`', 'رؤية رصيدك من عملة Ly'],
    ['اختصارات البادئة', `${prefix}addmoney / ${prefix}resetmoney / ${prefix}takemoney / ${prefix}transfer / ${prefix}balance`]
  ]}
};

function helpButtons(activeId) {
  const ids = Object.keys(HELP_CATEGORIES);
  const rows = [];
  for (let i = 0; i < ids.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      ids.slice(i, i + 5).map(id =>
        new ButtonBuilder()
          .setCustomId(id)
          .setLabel(HELP_CATEGORIES[id].label)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(HELP_CATEGORIES[id].emoji)
          .setDisabled(id === activeId)
      )
    ));
  }
  return rows;
}

function helpEmbed(categoryKey, interaction) {
  const cat = HELP_CATEGORIES[categoryKey];
  return new EmbedBuilder()
    .setAuthor({ name: interaction.guild?.name || 'UniBot', iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined })
    .setTitle('قائمة اوامر البوت')
    .setColor('#ef4444')
    .setTimestamp()
    .setFooter({ text: `Requested By ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
    .setFields(cat.cmds.map(([name, value]) => ({ name, value })));
}

// ══════════════ تحميل الأوامر ══════════════
const folderPath = path.join(__dirname, 'slashcommand27');
const commandsMap = new Map();
commandsMap.set('help', { name: 'help', description: 'عرض جميع أوامر البوت' });
commandsMap.set('ping', { name: 'ping', description: 'معرفة سرعة استجابة البوت' });
commandsMap.set('balance', { name: 'balance', description: 'معرفة رصيدك من عملة Ly' });
for (const ex of EXTRA_COMMANDS) {
  commandsMap.set(ex.name, { name: ex.name, description: ex.description, options: ex.options });
}
try {
  for (const folder of readdirSync(folderPath).filter(f => !f.includes('.'))) {
    for (const file of readdirSync(path.join(folderPath, folder)).filter(f => f.endsWith('.js') && !f.startsWith('.'))) {
      const command = require(path.join(folderPath, folder, file));
      if (command?.data?.name) {
        commandsMap.set(command.data.name, command.data.toJSON());
        client.commands.set(command.data.name, command);
      }
    }
  }
} catch (e) {
  console.error('❌ خطأ تحميل مجلد الأوامر:', e.message);
}
const finalSlashCommands = Array.from(commandsMap.values());

// ══════════════ دوال مساعدة ══════════════
const getWallets = (gid) => walletDB.get(gid) || {};
function setBal(gid, uid, val) {
  const w = getWallets(gid);
  w[uid] = Math.max(0, val);
  walletDB.set(gid, w);
}
function logTransfer(gid, from, to, amount, type) {
  const logs = walletDB.get(`logs_${gid}`) || [];
  logs.unshift({ type, from, to, amount, at: Date.now() });
  if (logs.length > 100) logs.length = 100;
  walletDB.set(`logs_${gid}`, logs);
}

// ══════════════ إنشاء روم تذكرة مع إيمبد وأزرار استلام وحذف ══════════════
async function createTicketChannel(interaction) {
  const g = interaction.guild;
  const db = ticketDB.get(g.id) || {};
  const cleanUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || interaction.user.id;
  const name = `ticket-${cleanUser}`;

  const overwrites = [
    { id: g.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles
      ]
    }
  ];

  if (db.ticketSupportRole && g.roles.cache.has(db.ticketSupportRole)) {
    overwrites.push({
      id: db.ticketSupportRole,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels
      ]
    });
  }

  const channel = await g.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: db.ticketCategory || null,
    permissionOverwrites: overwrites
  });

  const welcomeText = db.ticketWelcomeMsg || 'مرحباً بك، سيتم خدمتك قريباً.';
  const welcomeEmbed = new EmbedBuilder()
    .setAuthor({ name: g.name, iconURL: g.iconURL({ dynamic: true }) || undefined })
    .setTitle('🎫 تذكرة جديدة')
    .setDescription(`${welcomeText}\n\n**صاحب التذكرة:** <@${interaction.user.id}>`)
    .setColor('#8b5cf6')
    .setFooter({ text: `Ticket Owner: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
    .setTimestamp();

  const ticketRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dash_ticket_claim_${interaction.user.id}`)
      .setLabel('🙋 استلام التذكرة')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('dash_ticket_delete')
      .setLabel('🗑️ حذف التذكرة')
      .setStyle(ButtonStyle.Danger)
  );

  const mentionContent = db.ticketSupportRole
    ? `<@${interaction.user.id}> <@&${db.ticketSupportRole}>`
    : `<@${interaction.user.id}>`;

  await channel.send({ content: mentionContent, embeds: [welcomeEmbed], components: [ticketRow] });
  return channel;
}

// ══════════════ التفاعلات ══════════════
client.on(Events.InteractionCreate, async (interaction) => {

  // ── أزرار قائمة الهلب ──
  if (interaction.isButton() && HELP_CATEGORIES[interaction.customId]) {
    return interaction.update({
      embeds: [helpEmbed(interaction.customId, interaction)],
      components: helpButtons(interaction.customId)
    }).catch(() => {});
  }

  // ── أزرار استلام وحذف التذكرة (المُنشأة من الداشبورد) ──
  if (interaction.isButton() && interaction.customId.startsWith('dash_ticket_claim_')) {
    const db = ticketDB.get(interaction.guild.id) || {};
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isSupport = db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole);
    if (!isAdmin && !isSupport) {
      return interaction.reply({ content: '❌ هذا الزر لفريق الدعم أو الإدارة فقط.', flags: [MessageFlags.Ephemeral] });
    }

    const ownerId = interaction.customId.replace('dash_ticket_claim_', '');
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        ManageChannels: true
      });
      if (db.ticketSupportRole && interaction.guild.roles.cache.has(db.ticketSupportRole)) {
        await interaction.channel.permissionOverwrites.edit(db.ticketSupportRole, {
          ViewChannel: true,
          SendMessages: false
        }).catch(() => {});
      }
      if (ownerId) {
        await interaction.channel.permissionOverwrites.edit(ownerId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        }).catch(() => {});
      }
    } catch (e) {
      console.error('claim ticket:', e.message);
    }

    const claimedEmbed = EmbedBuilder.from(interaction.message.embeds[0] || new EmbedBuilder())
      .addFields({ name: '📌 تم الاستلام بواسطة', value: `<@${interaction.user.id}>`, inline: true });

    const updatedRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(interaction.customId)
        .setLabel(`✅ مستلمة بواسطة ${interaction.user.username}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('dash_ticket_delete')
        .setLabel('🗑️ حذف التذكرة')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [claimedEmbed], components: [updatedRow] }).catch(() => {});
    return interaction.followUp({ content: `✅ تم استلام التذكرة بواسطة <@${interaction.user.id}>` }).catch(() => {});
  }

  if (interaction.isButton() && interaction.customId === 'dash_ticket_delete') {
    const db = ticketDB.get(interaction.guild.id) || {};
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isSupport = db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole);
    const isOwner = interaction.channel.topic === interaction.user.id || interaction.channel.name.includes(interaction.user.username.toLowerCase());
    if (!isAdmin && !isSupport && !isOwner) {
      return interaction.reply({ content: '❌ ليس لديك صلاحية حذف التذكرة.', flags: [MessageFlags.Ephemeral] });
    }
    await interaction.reply({ content: '🗑️ سيتم حذف التذكرة خلال 3 ثوانٍ...' }).catch(() => {});
    setTimeout(() => {
      interaction.channel.delete('UniBot: ticket deleted').catch(() => {});
    }, 3000);
    return;
  }

  // ── أزرار القبول/الرفض للتقديمات ──
  if (interaction.isButton() && (interaction.customId === 'apply_accept' || interaction.customId === 'apply_reject')) {
    const L = lang(interaction.guild.id);
    const cfg = presentDB.get(interaction.guild.id) || {};
    const hasAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasApplyRole = cfg.applyAdminRole && interaction.member.roles.cache.has(cfg.applyAdminRole);
    if (!hasAdmin && !hasApplyRole) {
      return interaction.reply({ content: '❌ للإدارة أو رتبة التقديم فقط', flags: [MessageFlags.Ephemeral] });
    }

    const matchUser = (interaction.message.content || '').match(/<@(\d+)>/) ||
      (interaction.message.embeds?.[0]?.description || '').match(/<@(\d+)>/);
    const applicantId = matchUser?.[1];
    const accepted = interaction.customId === 'apply_accept';
    const roleId = accepted ? cfg.applyAcceptRole : cfg.applyRejectRole;

    const customAcceptMsg = (cfg.applyAcceptDmText || '').trim();
    const customRejectMsg = (cfg.applyRejectDmText || '').trim();

    await interaction.message.reply(
      accepted
        ? (L === 'ar' ? `✅ تم **قبول** تقديم <@${applicantId}> بواسطة ${interaction.user}` : `✅ Application of <@${applicantId}> **accepted** by ${interaction.user}`)
        : (L === 'ar' ? `❌ تم **رفض** تقديم <@${applicantId}> بواسطة ${interaction.user}` : `❌ Application of <@${applicantId}> **rejected** by ${interaction.user}`)
    );

    // رسالة خاصة للمتقدم (حسب الإعداد)
    const dmEnabled = cfg.applyDmNotify === true || cfg.applyDmNotify === 'on';
    if (dmEnabled && applicantId) {
      const user = await client.users.fetch(applicantId).catch(() => null);
      if (user) {
        const dm = accepted
          ? (customAcceptMsg || (L === 'ar'
              ? `🎉 مبروك! تم **قبول** تقديمك في سيرفر **${interaction.guild.name}**`
              : `🎉 Congratulations! Your application to **${interaction.guild.name}** was **accepted**`))
          : (customRejectMsg || (L === 'ar'
              ? `نعتذر، تم **رفض** تقديمك في سيرفر **${interaction.guild.name}**`
              : `Sorry, your application to **${interaction.guild.name}** was **rejected**`));
        user.send(dm).catch(() => {});
      }
    }

    // منح رتبة القبول أو سحبها
    if (roleId && applicantId) {
      const member = await interaction.guild.members.fetch(applicantId).catch(() => null);
      if (member && interaction.guild.roles.cache.has(roleId)) {
        if (accepted) member.roles.add(roleId).catch(() => {});
        else if (cfg.applyRejectRemoveRole) member.roles.remove(roleId).catch(() => {});
      }
    }

    // تعطيل الأزرار
    const disabled = ActionRowBuilder.from(interaction.message.components[0]);
    disabled.components.forEach(c => c.setDisabled(true));
    return interaction.update({ components: [disabled] }).catch(() => {});
  }

  // ── فتح تذكرة (زر) أو منيو ──
  if (interaction.isButton() && interaction.customId === 'create_ticket') {
    const L = lang(interaction.guild.id);
    try {
      const channel = await createTicketChannel(interaction);
      return interaction.reply({ content: T[L].ticketCreated(channel), flags: [MessageFlags.Ephemeral] });
    } catch (e) {
      console.error('ticket:', e.message);
      return interaction.reply({ content: T[L].ticketError, flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket') {
    const L = lang(interaction.guild.id);
    try {
      const channel = await createTicketChannel(interaction);
      return interaction.reply({ content: T[L].ticketCreated(channel), flags: [MessageFlags.Ephemeral] });
    } catch (e) {
      console.error('ticket menu:', e.message);
      return interaction.reply({ content: T[L].ticketError, flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
  }

  // ── زر التقديم: فتح مودال الأسئلة المضافة من الموقع ──
  if (interaction.isButton() && interaction.customId === 'open_apply') {
    const cfg = presentDB.get(interaction.guild.id) || {};
    const rawQuestions = Array.isArray(cfg.applyQuestions) && cfg.applyQuestions.length
      ? cfg.applyQuestions.map(q => typeof q === 'string' ? q : (q.label || q.question || '')).filter(Boolean)
      : ['اسمك وعمرك؟', 'لماذا تريد الانضمام؟'];
    const questions = rawQuestions.slice(0, 5);

    const modal = new ModalBuilder()
      .setCustomId('apply_modal')
      .setTitle((cfg.applyPanelTitle || '📝 تقديم').slice(0, 45));

    questions.forEach((q, i) => {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q_${i}`)
          .setLabel(String(q).slice(0, 45))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ));
    });
    return interaction.showModal(modal);
  }

  // ── إرسال إجابات التقديم إلى روم الاستقبال ──
  if (interaction.isModalSubmit() && interaction.customId === 'apply_modal') {
    const L = lang(interaction.guild.id);
    const cfg = presentDB.get(interaction.guild.id) || {};
    const rawQuestions = Array.isArray(cfg.applyQuestions) && cfg.applyQuestions.length
      ? cfg.applyQuestions.map(q => typeof q === 'string' ? q : (q.label || q.question || '')).filter(Boolean)
      : [];

    const answers = interaction.fields.fields.map((f, idx) => {
      const qLabel = rawQuestions[idx] || f.customId;
      return `**${qLabel}:**\n${f.value}`;
    }).join('\n\n');

    const rc = interaction.guild.channels.cache.get(cfg.applyReceiveChannel);
    await interaction.reply({
      content: L === 'ar' ? '✅ تم إرسال تقديمك بنجاح!' : '✅ Your application was submitted!',
      flags: [MessageFlags.Ephemeral]
    });

    if (rc) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_accept').setLabel('✅ قبول').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('apply_reject').setLabel('❌ رفض').setStyle(ButtonStyle.Danger)
      );
      const subEmbed = new EmbedBuilder()
        .setTitle('📝 طلب تقديم جديد')
        .setDescription(`**المتقدم:** <@${interaction.user.id}> (\`${interaction.user.id}\`)\n\n${answers}`)
        .setColor('#3b82f6')
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await rc.send({ content: `📥 تقديم جديد من <@${interaction.user.id}>`, embeds: [subEmbed], components: [row] }).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.user.bot) return;
  const { commandName } = interaction;
  const L = lang(interaction.guild?.id);

  // ── /help ──
  if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setAuthor({ name: interaction.guild?.name || 'UniBot', iconURL: interaction.guild?.iconURL({ dynamic: true }) })
      .setTitle(T[L].helpTitle)
      .setDescription(T[L].helpDesc)
      .setColor('#ef4444')
      .setFooter({ text: `Requested By ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
    return interaction.reply({ embeds: [embed], components: helpButtons(null) }).catch(() => {});
  }

  // ── /ping ──
  if (commandName === 'ping') {
    return interaction.reply({ content: `🏓 Pong! ${Math.round(client.ws.ping)}ms`, flags: [MessageFlags.Ephemeral] });
  }

  // ── /balance ──
  if (commandName === 'balance') {
    const bal = getWallets(interaction.guild.id)[interaction.user.id] ?? 0;
    return interaction.reply({ content: T[L].balance(bal), flags: [MessageFlags.Ephemeral] });
  }

  // ── أوامر الاقتصاد ──
  const extra = EXTRA_COMMANDS.find(c => c.name === commandName);
  if (extra) {
    if (extra.ownerOnly && !isOwnerMember(interaction.member)) {
      return interaction.reply({ content: T[L].ownerOnly, flags: [MessageFlags.Ephemeral] });
    }
    const gid = interaction.guild.id;
    const target = interaction.options.getUser('member');
    const amount = interaction.options.getInteger('amount') || 0;

    try {
      if (commandName === 'addmoney') {
        const w = getWallets(gid);
        setBal(gid, target.id, (w[target.id] ?? 0) + amount);
        logTransfer(gid, 'SYSTEM', target.id, amount, 'add');
        return interaction.reply({ content: T[L].added(amount, `<@${target.id}>`, getWallets(gid)[target.id]) });
      }
      if (commandName === 'takebalance') {
        const w = getWallets(gid);
        setBal(gid, target.id, (w[target.id] ?? 0) - amount);
        logTransfer(gid, target.id, 'SYSTEM', amount, 'take');
        return interaction.reply({ content: T[L].taken(amount, `<@${target.id}>`, getWallets(gid)[target.id]) });
      }
      if (commandName === 'resetbalance') {
        const resetAll = interaction.options.getBoolean('all');
        if (resetAll) {
          const ids = Object.keys(getWallets(gid));
          walletDB.set(gid, {});
          return interaction.reply({ content: T[L].resetAll(ids.length) });
        }
        if (!target) return interaction.reply({ content: '⚠️ member / all', flags: [MessageFlags.Ephemeral] });
        setBal(gid, target.id, 0);
        return interaction.reply({ content: T[L].resetOne(`<@${target.id}>`) });
      }
      if (commandName === 'transfer') {
        if (target.bot) return interaction.reply({ content: T[L].botTransfer, flags: [MessageFlags.Ephemeral] });
        if (target.id === interaction.user.id) return interaction.reply({ content: T[L].selfTransfer, flags: [MessageFlags.Ephemeral] });
        if (amount <= 0) return interaction.reply({ content: T[L].badAmount, flags: [MessageFlags.Ephemeral] });
        const w = getWallets(gid);
        const senderBal = w[interaction.user.id] ?? 0;
        if (senderBal < amount) return interaction.reply({ content: T[L].noMoney(senderBal), flags: [MessageFlags.Ephemeral] });
        setBal(gid, interaction.user.id, senderBal - amount);
        setBal(gid, target.id, (w[target.id] ?? 0) + amount);
        logTransfer(gid, interaction.user.id, target.id, amount, 'transfer');
        return interaction.reply({ content: `${T[L].transferred(amount, `<@${target.id}>`)}\n${T[L].balance(getWallets(gid)[interaction.user.id])}` });
      }
    } catch (e) {
      console.error('economy:', e);
      return interaction.reply({ content: '⚠️ error', flags: [MessageFlags.Ephemeral] }).catch(() => {});
    }
  }

  // ── بقية أوامر المجلد ──
  const command = client.commands.get(commandName);
  if (command) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('🔴 خطأ في تنفيذ الأمر:', error);
      if (!interaction.replied) {
        interaction.reply({ content: '⚠️ حدث خطأ أثناء التنفيذ', flags: [MessageFlags.Ephemeral] }).catch(() => {});
      }
    }
  }
});

// ══════════════ الترحيب + الرتب التلقائية + محفظة جديدة ══════════════
client.on(Events.GuildMemberAdd, async (member) => {
  const g = member.guild;
  const L = lang(g.id);

  const wallets = getWallets(g.id);
  if (wallets[member.id] === undefined) {
    wallets[member.id] = 0;
    walletDB.set(g.id, wallets);
  }

  const w = systemDB.get(`welcome_${g.id}`) || {};
  if (w.welcomeToggle && w.welcomeChannel) {
    const ch = g.channels.cache.get(w.welcomeChannel);
    if (ch) {
      const msg = (w.wmsg || T[L].welcome('{member}', '{server}', '{count}'))
        .replaceAll('{member}', `<@${member.id}>`)
        .replaceAll('{server}', g.name)
        .replaceAll('{count}', String(g.memberCount));
      ch.send({ content: msg }).catch(() => {});
    }
  }

  const ar = autorankDB.get(g.id) || {};
  if (ar.autorankToggle && ar.joinRole) {
    const role = g.roles.cache.get(ar.joinRole);
    if (role) member.roles.add(role, 'UniBot: autorank').catch(() => {});
  }
});

// ══════════════ الردود التلقائية ══════════════
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  const data = autoreplyDB.get(message.guild.id);
  const list = Array.isArray(data) ? data : (data?.replies || []);
  for (const r of list) {
    if (r.trigger && message.content.toLowerCase().includes(r.trigger.toLowerCase())) {
      message.reply(r.response).catch(() => {});
      break;
    }
  }
});

// ══════════════ الاختصارات بالبادئة ══════════════
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  const mention = message.mentions.users.first();
  const amount = parseInt(args.find(a => /^\d+$/.test(a)) || '0');

  const reply = (c) => message.reply(c).catch(() => {});
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member) return;
  const owner = isOwnerMember(member);
  const gid = message.guild.id;
  const L = lang(gid);

  if (cmd === 'addmoney') {
    if (!owner) return reply(T[L].ownerOnly);
    if (!mention || !amount) return reply(`الاستخدام: \`${prefix}addmoney @شخص 100\``);
    const w = getWallets(gid);
    setBal(gid, mention.id, (w[mention.id] ?? 0) + amount);
    logTransfer(gid, 'SYSTEM', mention.id, amount, 'add');
    return reply(T[L].added(amount, `<@${mention.id}>`, getWallets(gid)[mention.id]));
  }
  if (['resetmoney', 'resetbalance'].includes(cmd)) {
    if (!owner) return reply(T[L].ownerOnly);
    if (args[0] === 'all') {
      walletDB.set(gid, {});
      return reply('♻️ done');
    }
    if (!mention) return reply(`\`${prefix}resetmoney @شخص\` أو \`${prefix}resetmoney all\``);
    setBal(gid, mention.id, 0);
    return reply(T[L].resetOne(`<@${mention.id}>`));
  }
  if (['takemoney', 'takebalance'].includes(cmd)) {
    if (!owner) return reply(T[L].ownerOnly);
    if (!mention || !amount) return reply(`\`${prefix}takemoney @شخص 100\``);
    const w = getWallets(gid);
    setBal(gid, mention.id, (w[mention.id] ?? 0) - amount);
    logTransfer(gid, mention.id, 'SYSTEM', amount, 'take');
    return reply(T[L].taken(amount, `<@${mention.id}>`, getWallets(gid)[mention.id]));
  }
  if (cmd === 'transfer') {
    if (!mention || !amount || amount <= 0) return reply(`\`${prefix}transfer @شخص 100\``);
    if (mention.id === message.author.id) return reply(T[L].selfTransfer);
    const w = getWallets(gid);
    const bal = w[message.author.id] ?? 0;
    if (bal < amount) return reply(T[L].noMoney(bal));
    setBal(gid, message.author.id, bal - amount);
    setBal(gid, mention.id, (w[mention.id] ?? 0) + amount);
    logTransfer(gid, message.author.id, mention.id, amount, 'transfer');
    return reply(`${T[L].transferred(amount, `<@${mention.id}>`)}\n${T[L].balance(getWallets(gid)[message.author.id])}`);
  }
  if (['balance', 'رصيدي'].includes(cmd)) {
    return reply(T[L].balance(getWallets(gid)[message.author.id] ?? 0));
  }
  if (cmd === 'help') {
    const embed = new EmbedBuilder()
      .setTitle(T[L].helpTitle)
      .setDescription(T[L].helpDesc)
      .setColor('#ef4444');
    const m = await message.reply({ embeds: [embed], components: helpButtons(null) }).catch(() => null);
    if (m) {
      const collector = m.createMessageComponentCollector({ time: 120000 });
      collector.on('collect', async (i) => {
        if (!HELP_CATEGORIES[i.customId]) return;
        await i.update({ embeds: [helpEmbed(i.customId, i)], components: helpButtons(i.customId) }).catch(() => {});
      });
    }
  }
});

// ══════════════ نظام الحماية ══════════════
const PROTECTIONS = [
  { key: 'prot_ban',          audit: AuditLogEvent.MemberBanAdd,  name: 'حماية حظر الأعضاء' },
  { key: 'prot_kick',         audit: AuditLogEvent.MemberKick,    name: 'حماية طرد الأعضاء' },
  { key: 'prot_channel_name', audit: AuditLogEvent.ChannelUpdate, name: 'حماية تغيير أسماء الشاتات' },
  { key: 'prot_channel_del',  audit: AuditLogEvent.ChannelDelete, name: 'حماية مسح الشاتات' },
  { key: 'prot_add_role',     audit: AuditLogEvent.RoleCreate,    name: 'حماية إضافة رتب' },
  { key: 'prot_server_edit',  audit: AuditLogEvent.GuildUpdate,   name: 'حماية تغيير معلومات السيرفر' }
];
const PROTECTION_EVENTS = {
  [AuditLogEvent.MemberBanAdd]:  'guildBanAdd',
  [AuditLogEvent.MemberKick]:    'guildMemberRemove',
  [AuditLogEvent.ChannelUpdate]: 'channelUpdate',
  [AuditLogEvent.ChannelDelete]: 'channelDelete',
  [AuditLogEvent.RoleCreate]:    'guildRoleCreate',
  [AuditLogEvent.GuildUpdate]:   'guildUpdate'
};

async function punishExecutor(guild, executor, protKey, name) {
  if (!executor || executor.bot || executor.id === guild.ownerId) return;
  const cfg = protectDB.get(guild.id) || {};
  const supportRoles = String(cfg[`${protKey}_role`] || '').split(',').filter(Boolean);
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return;
  if (member.roles.cache.some(r => supportRoles.includes(r.id))) return;

  const punishment = cfg[`${protKey}_punish`] || 'strip';
  const ch = guild.channels.cache.get(cfg.protectLogRoom);
  if (ch) {
    ch.send({ embeds: [new EmbedBuilder()
      .setTitle('🛡️ نظام الحماية')
      .setColor('#ef4444')
      .addFields(
        { name: 'الحماية', value: name },
        { name: 'المنفذ', value: `${executor.tag} \`${executor.id}\`` },
        { name: 'العقوبة', value: punishment === 'ban' ? '🔨 حظر' : '🏷️ سحب الرتب' }
      )
    ]}).catch(() => {});
  }
  try {
    if (punishment === 'ban') await member.ban({ reason: `UniBot: ${name}` });
    else await member.roles.set([], `UniBot: ${name}`);
  } catch (e) { console.error('punish:', e.message); }
}

for (const p of PROTECTIONS) {
  client.on(PROTECTION_EVENTS[p.audit], async (arg1) => {
    const guild = arg1.guild || arg1;
    if (!guild) return;
    const cfg = protectDB.get(guild.id) || {};
    if (!cfg[`${p.key}_on`]) return;
    const logs = await guild.fetchAuditLogs({ limit: 1, type: p.audit }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 10000) return;
    await punishExecutor(guild, entry.executor, p.key, p.name);
  });
}

client.on(Events.GuildMemberAdd, async (member) => {
  if (!member.user.bot) return;
  const cfg = protectDB.get(member.guild.id) || {};
  if (cfg.prot_bots_on) {
    const ch = member.guild.channels.cache.get(cfg.protectLogRoom);
    if (ch) ch.send({ content: `🛡️ تم طرد البوت: ${member.user.tag}` }).catch(() => {});
    await member.kick('UniBot: bot protection').catch(() => {});
  } else if (cfg.prot_untrusted_on) {
    const isVerified = member.user.flags?.has('VerifiedBot') || member.user.verified;
    if (!isVerified) await member.kick('UniBot: unverified bot').catch(() => {});
  }
});

// ══════════════ Dashboard API ══════════════
const sessions = new Map();
const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

async function discordFetch(url, token2) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token2}` } });
  return r.json();
}

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
      redirect_uri
    })
  });
  const tokenData = await r.json();
  if (!tokenData.access_token) return res.status(401).json({ error: 'bad code', detail: tokenData });
  const me = await discordFetch('https://discord.com/api/v10/users/@me', tokenData.access_token);
  const sToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sToken, { userId: me.id, discordToken: tokenData.access_token, username: me.username, avatar: me.avatar, expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
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
    const botGuild = client.guilds.cache.get(g.id);
    if (!botGuild) continue;
    result.push({ id: g.id, name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null });
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
    if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return res.status(403).json({ error: 'not admin' });
    req.guild = guild;
    next();
  } catch {
    return res.status(403).json({ error: 'not member' });
  }
}

app.get('/api/guild/:guildId/members', requireGuildAdmin, (req, res) => {
  const members = req.guild.members.cache
    .filter(m => !m.user.bot)
    .map(m => ({ id: m.id, name: m.user.tag }))
    .slice(0, 500);
  res.json(members);
});

app.get('/api/guild/:guildId/data', requireGuildAdmin, (req, res) => {
  const g = req.guild;
  const channels = g.channels.cache.map(c => ({ id: c.id, name: (c.type === ChannelType.GuildCategory ? '📁 ' : '#') + c.name, type: c.type }));
  const roles = g.roles.cache.filter(r => r.name !== '@everyone' && !r.managed).map(r => ({ id: r.id, name: r.name }));
  const wallets = getWallets(g.id);
  const s = sessions.get(req.headers['x-session']);
  const balance = s && wallets[s.userId] !== undefined ? wallets[s.userId] : 0;
  res.json({
    channels, roles,
    wallet: { balance, logs: walletDB.get(`logs_${g.id}`) || [] },
    settings: {
      settings:   systemDB.get(`settings_${g.id}`) || {},
      welcome:    systemDB.get(`welcome_${g.id}`) || {},
      autorank:   autorankDB.get(g.id) || {},
      tickets:    ticketDB.get(g.id) || {},
      protect:    protectDB.get(g.id) || {},
      levels:     levelsDB.get(g.id) || {},
      present:    presentDB.get(g.id) || {},
      autoreply:  { replies: autoreplyDB.get(g.id)?.replies || [] },
      embeds:     embedsDB.get(g.id) || { list: [] }
    }
  });
});

app.post('/api/settings/:guildId/:system', requireGuildAdmin, (req, res) => {
  const gid = req.params.guildId;
  const body = req.body || {};
  const old = (db) => db.get(gid) || {};

  switch (req.params.system) {
    case 'welcome': systemDB.set(`welcome_${gid}`, body); break;
    case 'settings': systemDB.set(`settings_${gid}`, body); break;
    case 'autorank': autorankDB.set(gid, body); break;
    case 'tickets': ticketDB.set(gid, { ...old(ticketDB), ...body }); break;
    case 'protect': protectDB.set(gid, body); break;
    case 'levels': levelsDB.set(gid, body); break;
    case 'present': presentDB.set(gid, { ...old(presentDB), ...body }); break;
    case 'embeds': embedsDB.set(gid, { list: body.list || [] }); break;
    case 'autoreply': autoreplyDB.set(gid, { replies: body.replies || [] }); break;
    case 'broadcasts': broadcastDB.set(gid, body); break;
    default: return res.status(400).json({ error: 'unknown system' });
  }
  res.json({ ok: true });
});

app.post('/api/embed-send/:guildId', requireGuildAdmin, async (req, res) => {
  const { channelId, title, description, color } = req.body;
  const ch = req.guild.channels.cache.get(channelId);
  if (!ch) return res.status(400).json({ error: 'channel not found' });
  await ch.send({ embeds: [new EmbedBuilder()
    .setTitle(title || null)
    .setDescription(description || null)
    .setColor(color || '#ef4444')
  ]}).catch(() => {});
  res.json({ ok: true });
});

app.post('/api/ticket-panel/:guildId', requireGuildAdmin, async (req, res) => {
  const t = ticketDB.get(req.guild.id) || {};
  const ch = req.guild.channels.cache.get(t.ticketPanelChannel);
  if (!ch) return res.status(400).json({ error: 'panel channel not set' });

  const embed = new EmbedBuilder()
    .setTitle(t.ticketEmbedTitle || '🎫 نظام التذاكر')
    .setDescription(t.ticketEmbedDesc || 'اضغط الزر لفتح تذكرة.')
    .setColor('#8b5cf6');

  let components;
  if (t.ticketType === 'menu') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select_ticket')
      .setPlaceholder('🎫 اختر لفتح تذكرة...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎫 فتح تذكرة').setValue('open_ticket').setDescription('افتح تذكرة دعم جديدة')
      );
    components = [new ActionRowBuilder().addComponents(menu)];
  } else {
    components = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('create_ticket').setLabel('🎫 فتح تذكرة').setStyle(ButtonStyle.Primary)
    )];
  }
  await ch.send({ embeds: [embed], components });
  res.json({ ok: true });
});

// بانل التقديم (نموذج + صورة)
app.post('/api/apply-panel/:guildId', requireGuildAdmin, async (req, res) => {
  const cfg = presentDB.get(req.guild.id) || {};
  const ch = req.guild.channels.cache.get(cfg.applyPanelChannel);
  if (!ch) return res.status(400).json({ error: 'panel channel not set' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_apply')
      .setLabel(cfg.applyPanelButtonText || '📝 تقديم')
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setTitle(cfg.applyPanelTitle || '📝 نظام التقديم')
    .setDescription(cfg.applyPanelDesc || 'اضغط الزر أدناه لفتح نموذج التقديم.')
    .setColor('#3b82f6');

  const files = [];
  const img = String(cfg.applyImageUrl || cfg.applyImage || '').trim();
  if (/^https?:\/\//i.test(img)) {
    embed.setImage(img);
  } else if (img.startsWith('data:image/')) {
    const match = img.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const ext = match[1].split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      const buffer = Buffer.from(match[2], 'base64');
      const fileName = `apply-banner.${ext}`;
      files.push({ attachment: buffer, name: fileName });
      embed.setImage(`attachment://${fileName}`);
    }
  }

  await ch.send({ embeds: [embed], components: [row], files });
  res.json({ ok: true });
});

app.post('/api/broadcast/:guildId', requireGuildAdmin, async (req, res) => {
  const { type, target, content, userId } = req.body;
  if (!content) return res.status(400).json({ error: 'no content' });
  const send = async (user) => {
    if (type === 'embed') await user.send({ embeds: [new EmbedBuilder().setDescription(content).setColor('#ef4444')] }).catch(() => {});
    else await user.send(content).catch(() => {});
  };
  try {
    if (target === 'one' && userId) {
      const m = await req.guild.members.fetch(userId).catch(() => null);
      if (!m) return res.status(404).json({ error: 'member not found' });
      await send(m.user);
      return res.json({ ok: true, sent: 1 });
    }
    let sent = 0;
    const members = await req.guild.members.fetch();
    for (const [, m] of members) {
      if (m.user.bot) continue;
      await send(m.user);
      sent++;
      await new Promise(r => setTimeout(r, 500));
    }
    res.json({ ok: true, sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.json({
    servers: client.guilds.cache.size,
    users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    ping: Math.round(client.ws.ping),
    uptime: Math.floor((Date.now() - bootTime) / 1000),
    status: client.ws.status === 0 ? 'online' : 'offline'
  });
});

client.once('clientReady', async () => {
  try {
    await rest.put(Routes.applicationCommands(clientId || client.user.id), { body: finalSlashCommands });
    console.log(`✅ تم تسجيل ${finalSlashCommands.length} أمر`);
  } catch (error) {
    console.error('❌ خطأ تسجيل الأوامر:', error);
  }
  console.log(`🟢 UniBot online — ${client.user.tag}`);

  for (const h of ['suggest', 'tax4bot', 'autorole', 'claim', 'close', 'create', 'reset',
    'support-panel', 'joinGiveaway', 'applyCreate', 'applyResult', 'applySubmit',
    'info', 'musicPrefix', 'setBroadcastMessage']) {
    try {
      require(`./handlers/${h}`)(client);
      console.log(`✅ handler: ${h}`);
    } catch (e) {
      console.error(`❌ handler ${h}:`, e.message);
    }
  }
});

const PORT = process.env.SERVER_PORT || process.env.PORT || 7050;
app.listen(PORT, '0.0.0.0', () => console.log(`🖥️ Dashboard API on port ${PORT}`));

process.on('uncaughtException', e => console.error('uncaught:', e));
process.on('unhandledRejection', r => console.error('unhandled:', r));

client.login(token);
