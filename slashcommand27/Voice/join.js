const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("يخلي البوت يدخل ويقعد في روم صوتي معين")
    .addStringOption((o) => o.setName("ايدي_الروم").setDescription("ايدي الروم الصوتي").setRequired(true)),
  async execute(interaction) {
    const channelId = interaction.options.getString("ايدي_الروم").trim();
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      return interaction.reply({ content: "❗ ما لقيت روم بهذا الايدي في هذا السيرفر.", ephemeral: true });
    }
    if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
      return interaction.reply({ content: "❗ هذا الروم مو روم صوتي.", ephemeral: true });
    }

    const me = interaction.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms || !perms.has(PermissionsBitField.Flags.Connect)) {
      return interaction.reply({ content: "❗ ما عندي صلاحية **الدخول** لهذا الروم.", ephemeral: true });
    }

    await interaction.deferReply();

    // إذا البوت متصل بروم ثاني بنفس السيرفر، اقطعه أول
    const existing = getVoiceConnection(interaction.guild.id);
    if (existing) {
      try {
        existing.destroy();
      } catch (_) {}
    }

    const connect = () => {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      // إعادة الاتصال تلقائيًا لو انقطع الاتصال (بدون أوامر يدوية) طالما البوت شغال
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
          // البوت رجع يتصل من تلقاء نفسه، ما نسوي شي
        } catch (_) {
          try {
            connection.destroy();
          } catch (_) {}
          if (!interaction.client.voiceChannels) interaction.client.voiceChannels = new Map();
          // نتأكد إنه لسا المفروض يكون متصل (ما تم /leave يدوي) قبل لا نعيد المحاولة
          const should = interaction.client.voiceChannels.get(channel.guild.id);
          if (should && should === channel.id) {
            connect();
          }
        }
      });

      if (!interaction.client.voiceChannels) interaction.client.voiceChannels = new Map();
      interaction.client.voiceChannels.set(channel.guild.id, channel.id);

      return connection;
    };

    connect();

    return interaction.editReply({ content: `✅ دخلت روم <#${channel.id}> وباقعد فيه طول ما أنا شغال، ما بطلع إلا لو حد سوى \`/leave\`.` });
  },
};
