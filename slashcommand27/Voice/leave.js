const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

module.exports = {
  data: new SlashCommandBuilder().setName("leave").setDescription("يخلي البوت يطلع من الروم الصوتي"),
  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guild.id);

    if (interaction.client.voiceChannels) {
      interaction.client.voiceChannels.delete(interaction.guild.id);
    }

    if (!connection) {
      return interaction.reply({ content: "❗ أنا مو متصل بأي روم صوتي بهذا السيرفر.", ephemeral: true });
    }

    try {
      connection.destroy();
    } catch (_) {}

    return interaction.reply({ content: "👋 طلعت من الروم الصوتي." });
  },
};
