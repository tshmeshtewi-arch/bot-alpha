// commands-extra.js
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionsBitField, Events, MessageFlags, ApplicationCommandOptionType
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { readdirSync } = require('fs');
const path = require('path');
const { Database } = require('st.db');
const { token, clientId, prefix } = require('./config.js');

const walletDB = new Database('/Json-db/Bots/walletDB.json');

// ═══ رتبة/ايدي الأونر ═══
const OWNER_ID = process.env.OWNER_ID || '';
const OWNER_ROLE_ID = '1274111498980954124';

function isOwner(interaction) {
  if (OWNER_ID && interaction.user.id === OWNER_ID) return true;
  return interaction.member.roles?.cache?.has(OWNER_ROLE_ID) || false;
}

// ═══ الأوامر الجديدة ═══
const EXTRA_COMMANDS = [
  {
    name: 'addmoney',
    description: 'إضافة رصيد لعضو — أوامر الدعم فقط',
    options: [
      { name: 'member', description:العضو', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ],
    ownerOnly: true
  },
  {
    name: 'resetbalance',
    description: 'تصفير رصيد عضو أو جميع الأعضاء — أوامر الدعم فقط',
    options: [
      { name: 'member', description: 'العضو (اتركه فارغاً لو اخترت all)', type: ApplicationCommandOptionType.User, required: false },
      { name: 'all', description: 'تصفير جميع الأعضاء؟', type: ApplicationCommandOptionType.Boolean, required: false }
    ],
    ownerOnly: true
  },
  {
    name: 'takebalance',
    description: 'سحب مبلغ من عضو — أوامر الدعم فقط',
    options: [
      { name: 'member', description: 'العضو', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ],
    ownerOnly: true
  },
  {
    name: 'transfer',
    description: 'تحويل رصيد من محفظتك لعضو آخر',
    options: [
      { name: 'member', description: 'العضو المستلم', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'المبلغ', type: ApplicationCommandOptionType.Integer, required: true }
    ],
    ownerOnly: false
  }
];

// ═══ أقسام /help ═══
const HELP_CATEGORIES = {
  help_tax: { label: 'ضريبة', emoji: '💰', cmds: [
    ['`/set-tax-room`', 'لتحديد روم الضريبة التلقائية'],
    ['`/set-tax-line`', 'لتحديد الخط'],
    ['`/tax-mode`', 'لتحديد شكل الضريبة'],
    ['`/tax` | `${prefix}tax`', 'لحساب ضريبة بروبوت اي مبلغ تريده']
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
    ['`${prefix}تقييم`', 'طلب تقييم']
  ]},
  help_system: { label: 'سيستم', emoji: '⚙️', cmds: [
    ['`/avatar`', 'لرؤية افتارك او افتار شخص اخر'],
    ['`/server` | `${prefix}server`', 'لرؤية معلومات السيرفر'],
    ['`/user`', 'لرؤية معلومات حسابك او حساب شخص اخر'],
    ['`/banner`', 'لرؤية بانرك او بانر شخص اخر'],
    ['`/setup-welcome`', 'تسطيب نظام الترحيب'],
    ['`/ban`', 'لاعطاء باند لشخص او ازالته'],
    ['`/clear` | `${prefix}clear`', 'لحذف عدد من الرسائل'],
    ['`/kick`', 'لاعطاء طرد لشخص او ازالته'],
    ['`/lock` | `${prefix}lock`', 'لقفل روم'],
    ['`/mute`', 'لاعطاء ميوت لشخص او ازالته'],
    ['`/role`', 'لاعطاء رتبة لشخص او ازالتها'],
    ['`/say` | `${prefix}say`', 'لقول كلام'],
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
    ['`/close` | `${prefix}close`', 'لاغلاق التكت'],
    ['`/delete` | `${prefix}delete`', 'لحذف التكت']
  ]},
  help_giveaway: { label: 'جيف اوي', emoji: '🎁', cmds: [
    ['`/gstart`', 'لبدا جيف اوي'],
    ['`/gend`', 'لانهاء جيف اوي'],
    ['`/greroll`', 'لاعادة الفائزين في جيف اوي']
  ]},
  help_protection: { label: 'حماية', emoji: '🛡️', cmds: [
    ['`/anti-ban`', 'لتسطيب نظام الحماية من الباند'],
    ['`/anti-bots`', 'لتسطيب نظام الحماية من البوتات'],
    ['`/anti-delete-roles`', 'لتسطيب الحماية من حذف الرتب'],
    ['`/anti-delete-rooms`', 'لتسطيب الحماية من حذف الرومات'],
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
    ['`${prefix}obc`', 'لارسال رسالة للأعضاء الأونلاين'],
    ['`${prefix}bc`', 'ارسال رسالة للكل'],
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
    ['`/balance` | `${prefix}balance`', 'رؤية رصيدك من عملة Ly'],
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
  const embed = new EmbedBuilder()
    .setAuthor({ name: interaction.guild?.name || 'UniBot', iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined })
    .setTitle('قائمة اوامر البوت')
    .setColor('#ef4444')
    .setTimestamp()
    .setFooter({ text: `Requested By ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
  for (const [name, value] of cat.cmds) {
    embed.addFields({ name, value: value.replaceAll('${prefix}', prefix) });
  }
  return embed;
}

module.exports = (client) => {
  const rest = new REST({ version: '10' }).setToken(token);

  // ═══ تسجيل كل الأوامر (القديمة + الجديدة) ═══
  const allCommands = [];
  const seen = new Set();

  // أوامر المجلد
  try {
    const folderPath = path.join(__dirname, 'slashcommand27');
    for (const folder of readdirSync(folderPath).filter(f => !f.includes('.'))) {
      for (const file of readdirSync(path.join(folderPath, folder)).filter(f => f.endsWith('.js') && !f.startsWith('.'))) {
        const cmd = require(path.join(folderPath, folder, file));
        if (cmd?.data?.name && !seen.has(cmd.data.name)) {
          seen.add(cmd.data.name);
          allCommands.push(cmd.data.toJSON());
          client.commands.set(cmd.data.name, cmd);
        }
      }
    }
  } catch (e) { console.error('❌ تحميل مجلد الأوامر:', e.message); }

  // أوامر النظام الأساسية
  const basics = [
    { name: 'help', description: 'عرض جميع أوامر البوت' },
    { name: 'ping', description: 'معرفة سرعة استجابة البوت' },
    { name: 'balance', description: 'معرفة رصيدك من عملة Ly' }
  ];
  for (const b of basics) {
    if (!seen.has(b.name)) { seen.add(b.name); allCommands.push(b); }
  }

  // الأوامر الجديدة
  for (const ex of EXTRA_COMMANDS) {
    if (!seen.has(ex.name)) {
      seen.add(ex.name);
      allCommands.push({ name: ex.name, description: ex.description, options: ex.options });
      client.commands.set(ex.name, { __extra: ex });
    }
  }

  client.once('clientReady', async () => {
    try {
      await rest.put(Routes.applicationCommands(clientId || client.user.id), { body: allCommands });
      console.log(`✅ تم تسجيل ${allCommands.length} أمر (شامل أوامر الدعم)`);
    } catch (e) { console.error('❌ تسجيل الأوامر:', e); }
  });

  // ═══ تنفيذ الأوامر ═══
  client.on(Events.InteractionCreate, async (interaction) => {
    // قائمة الهلب بالأزرار
    if (interaction.isButton() && interaction.customId.startsWith('help_')) {
      if (!HELP_CATEGORIES[interaction.customId]) return;
      return interaction.update({
        embeds: [helpEmbed(interaction.customId, interaction)],
        components: helpButtons(interaction.customId)
      }).catch(() => {});
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.bot) return;
    const { commandName } = interaction;

    // /help
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.guild?.name || 'UniBot', iconURL: interaction.guild?.iconURL({ dynamic: true }) })
        .setTitle('قائمة اوامر البوت')
        .setDescription('اختر القسم من الأزرار بالأسفل 👇')
        .setColor('#ef4444')
        .setFooter({ text: `Requested By ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
      return interaction.reply({ embeds: [embed], components: helpButtons(null) }).catch(() => {});
    }

    // /ping
    if (commandName === 'ping') {
      return interaction.reply({ content: `🏓 Pong! السرعة: ${Math.round(client.ws.ping)}ms`, flags: [MessageFlags.Ephemeral] });
    }

    // /balance — الرصيد الافتراضي 0
    if (commandName === 'balance') {
      const wallets = walletDB.get(interaction.guild.id) || {};
      const bal = wallets[interaction.user.id] ?? 0;
      return interaction.reply({ content: `💰 رصيدك الحالي: **${bal} Ly**`, flags: [MessageFlags.Ephemeral] });
    }

    // الأوامر الجديدة
    const extra = client.commands.get(commandName);
    if (extra?.__extra) {
      const ex = extra.__extra;
      if (ex.ownerOnly && !isOwner(interaction)) {
        return interaction.reply({ content: '❌ هذا الأمر لرتبة الأونر فقط', flags: [MessageFlags.Ephemeral] });
      }
      const gid = interaction.guild.id;
      const target = interaction.options.getUser('member');
      let amount = interaction.options.getInteger('amount') || 0;

      const getWallets = () => walletDB.get(gid) || {};
      const setBal = (uid, val) => { const w = getWallets(); w[uid] = Math.max(0, val); walletDB.set(gid, w); };

      try {
        if (commandName === 'addmoney') {
          const w = getWallets();
          setBal(target.id, (w[target.id] ?? 0) + amount);
          return interaction.reply({ content: `✅ تم إضافة **${amount} Ly** إلى <@${target.id}> — رصيده الآن: **${getWallets()[target.id]} Ly**` });
        }
        if (commandName === 'takebalance') {
          const w = getWallets();
          setBal(target.id, (w[target.id] ?? 0) - amount);
          return interaction.reply({ content: `✅ تم سحب **${amount} Ly** من <@${target.id}> — رصيده الآن: **${getWallets()[target.id]} Ly**` });
        }
        if (commandName === 'resetbalance') {
          const resetAll = interaction.options.getBoolean('all');
          if (resetAll) {
            const w = getWallets();
            const ids = Object.keys(w);
            walletDB.set(gid, {});
            return interaction.reply({ content: `♻️ تم تصفير حسابات **${ids.length}** عضو` });
          }
          if (!target) return interaction.reply({ content: '⚠️ حدد عضواً أو فعّل خيار all', flags: [MessageFlags.Ephemeral] });
          setBal(target.id, 0);
          return interaction.reply({ content: `♻️ تم تصفير رصيد <@${target.id}>` });
        }
        if (commandName === 'transfer') {
          if (target.bot) return interaction.reply({ content: '❌ لا يمكن التحويل لبوت', flags: [MessageFlags.Ephemeral] });
          if (target.id === interaction.user.id) return interaction.reply({ content: '❌ لا يمكنك التحويل لنفسك', flags: [MessageFlags.Ephemeral] });
          if (amount <= 0) return interaction.reply({ content: '⚠️ المبلغ يجب أن يكون أكبر من صفر', flags: [MessageFlags.Ephemeral] });
          const w = getWallets();
          const senderBal = w[interaction.user.id] ?? 0;
          if (senderBal < amount) return interaction.reply({ content: `❌ رصيدك غير كافٍ — رصيدك: **${senderBal} Ly**`, flags: [MessageFlags.Ephemeral] });
          setBal(interaction.user.id, senderBal - amount);
          setBal(target.id, (w[target.id] ?? 0) + amount);
          return interaction.reply({ content: `💸 تم تحويل **${amount} Ly** من <@${interaction.user.id}> إلى <@${target.id}>\nرصيدك الآن: **${getWallets()[interaction.user.id]} Ly**` });
        }
      } catch (e) {
        console.error('economy:', e);
        return interaction.reply({ content: '⚠️ حدث خطأ', flags: [MessageFlags.Ephemeral] }).catch(() => {});
      }
    }
  });

  // ═══ اختصارات البادئة ═══
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = (args.shift() || '').toLowerCase();
    const mention = message.mentions.users.first();
    let amount = parseInt(args.find(a => /^\d+$/.test(a)) || '0');

    const reply = (c) => message.reply(c).catch(() => {});
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;
    const owner = (OWNER_ID && message.author.id === OWNER_ID) || member.roles.cache.has(OWNER_ROLE_ID);

    const getWallets = () => walletDB.get(message.guild.id) || {};
    const setBal = (uid, val) => { const w = getWallets(); w[uid] = Math.max(0, val); walletDB.set(message.guild.id, w); };

    if (['addmoney', 'رصيد-اضافة'].includes(cmd)) {
      if (!owner) return reply('❌ هذا الأمر لرتبة الأونر فقط');
      if (!mention || !amount) return reply(`الاستخدام: \`${prefix}addmoney @شخص 100\``);
      const w = getWallets();
      setBal(mention.id, (w[mention.id] ?? 0) + amount);
      return reply(`✅ تم إضافة **${amount} Ly** إلى <@${mention.id}>`);
    }
    if (['resetmoney', 'تصفير'].includes(cmd)) {
      if (!owner) return reply('❌ هذا الأمر لرتبة الأونر فقط');
      if (args[0] === 'all') {
        walletDB.set(message.guild.id, {});
        return reply('♻️ تم تصفير جميع الحسابات');
      }
      if (!mention) return reply(`الاستخدام: \`${prefix}resetmoney @شخص\` أو \`${prefix}resetmoney all\``);
      setBal(mention.id, 0);
      return reply(`♻️ تم تصفير رصيد <@${mention.id}>`);
    }
    if (['takemoney', 'سحب'].includes(cmd)) {
      if (!owner) return reply('❌ هذا الأمر لرتبة الأونر فقط');
      if (!mention || !amount) return reply(`الاستخدام: \`${prefix}takemoney @شخص 100\``);
      const w = getWallets();
      setBal(mention.id, (w[mention.id] ?? 0) - amount);
      return reply(`✅ تم سحب **${amount} Ly** من <@${mention.id}>`);
    }
    if (['transfer', 'تحويل'].includes(cmd)) {
      if (!mention || !amount || amount <= 0) return reply(`الاستخدام: \`${prefix}transfer @شخص 100\``);
      const w = getWallets();
      const bal = w[message.author.id] ?? 0;
      if (bal < amount) return reply(`❌ رصيدك غير كافٍ — رصيدك: **${bal} Ly**`);
      setBal(message.author.id, bal - amount);
      setBal(mention.id, (w[mention.id] ?? 0) + amount);
      return reply(`💸 تم تحويل **${amount} Ly** إلى <@${mention.id}> — رصيدك الآن: **${getWallets()[message.author.id]} Ly**`);
    }
    if (['balance', 'رصيدي'].includes(cmd)) {
      const w = getWallets();
      return reply(`💰 رصيدك الحالي: **${w[message.author.id] ?? 0} Ly**`);
    }
    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('قائمة اوامر البوت')
        .setDescription('اختر القسم من الأزرار بالأسفل 👇')
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
};
