const { SlashCommandBuilder } = require("discord.js");
const music = require("../../Music/musicManager");

module.exports = {
  data: new SlashCommandBuilder().setName("queue").setDescription("عرض طابور الأغاني الحالي"),
  async execute(interaction) {
    const list = music.getQueueList(interaction.guild.id);
    if (!list.length) return interaction.reply({ content: "📭 الطابور فاضي.", ephemeral: true });
    return interaction.reply({
      content: `📜 **الطابور:**\n${list.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`,
    });
  },
};
