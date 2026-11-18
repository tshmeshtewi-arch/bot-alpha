const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { joinPhase, delay } = require("../../Games/gameUtils");

module.exports = {
  data: new SlashCommandBuilder().setName("نرد").setDescription("لعبة رمي النرد الجماعية - أعلى رقم يفوز"),
  async execute(interaction) {
    const { players } = await joinPhase(interaction, {
      title: "🎲 لعبة النرد",
      description: "كل لاعب يرمي النرد، صاحب الرقم الأعلى يفوز!",
      min: 2,
      max: 10,
      seconds: 20,
    });

    if (players.length < 2) {
      return interaction.followUp({ content: "❗ لم ينضم عدد كافٍ من اللاعبين، تم إلغاء اللعبة." });
    }

    let contenders = players;
    let roundNum = 1;

    while (true) {
      const rolls = contenders.map((id) => ({ id, roll: Math.floor(Math.random() * 6) + 1 }));
      const lines = rolls.map((r) => `<@${r.id}> 🎲 **${r.roll}**`).join("\n");
      await interaction.followUp({ content: `**الجولة ${roundNum}:**\n${lines}` });
      await delay(2000);

      const max = Math.max(...rolls.map((r) => r.roll));
      const winners = rolls.filter((r) => r.roll === max).map((r) => r.id);

      if (winners.length === 1) {
        const embed = new EmbedBuilder()
          .setColor("#57f287")
          .setTitle("🏆 انتهت اللعبة!")
          .setDescription(`الفائز: <@${winners[0]}> برقم **${max}**`);
        return interaction.followUp({ embeds: [embed] });
      }

      await interaction.followUp({ content: `⚖️ تعادل بين: ${winners.map((id) => `<@${id}>`).join(" | ")}، إعادة الرمي بينهم!` });
      contenders = winners;
      roundNum++;
      await delay(1500);
    }
  },
};
