const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const music = require("../../Music/musicManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("شغل أغنية من يوتيوب (رابط أو اسم)")
    .addStringOption((o) => o.setName("اغنية").setDescription("رابط يوتيوب أو اسم الأغنية").setRequired(true)),
  async execute(interaction) {
    const query = interaction.options.getString("اغنية");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: "❗ لازم تكون داخل روم صوتي عشان تشغل أغنية.", ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const result = await music.addSong({
        guild: interaction.guild,
        voiceChannel,
        textChannel: interaction.channel,
        query,
        requestedBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setColor("#57f287")
        .setDescription(
          result.position === 1
            ? `🎶 يشتغل الآن: **${result.title}**`
            : `➕ تمت الإضافة للطابور (#${result.position}): **${result.title}**`
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("🔴 /play error:", err);
      return interaction.editReply({ content: "❗ ما قدرت ألقى أو أشغل هذي الأغنية." });
    }
  },
};
