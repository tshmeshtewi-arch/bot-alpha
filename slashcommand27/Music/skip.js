const { SlashCommandBuilder } = require("discord.js");
const music = require("../../Music/musicManager");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("تخطي الأغنية الحالية"),
  async execute(interaction) {
    const done = music.skip(interaction.guild.id);
    return interaction.reply({ content: done ? "⏭️ تم تخطي الأغنية." : "❗ ما فيه أغنية شغالة حاليًا." });
  },
};
