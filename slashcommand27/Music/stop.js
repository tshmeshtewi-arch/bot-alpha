const { SlashCommandBuilder } = require("discord.js");
const music = require("../../Music/musicManager");

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("إيقاف التشغيل وتفريغ الطابور"),
  async execute(interaction) {
    const done = music.stop(interaction.guild.id);
    return interaction.reply({ content: done ? "⏹️ تم إيقاف التشغيل وتفريغ الطابور." : "❗ ما فيه أغنية شغالة حاليًا." });
  },
};
