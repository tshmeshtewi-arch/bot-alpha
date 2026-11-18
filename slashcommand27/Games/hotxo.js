const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { joinPhase, shuffle, delay } = require("../../Games/gameUtils");

module.exports = {
  data: new SlashCommandBuilder().setName("hotxo").setDescription("لعبة القنبلة الساخنة - مررها قبل ما تنفجر!"),
  async execute(interaction) {
    const { players } = await joinPhase(interaction, {
      title: "🔥 القنبلة الساخنة",
      description: "القنبلة راح تدور عشوائي بين اللاعبين، اللي تنفجر عنده يخرج من اللعبة!",
      min: 3,
      max: 12,
      seconds: 20,
    });

    if (players.length < 3) {
      return interaction.followUp({ content: "❗ لم ينضم عدد كافٍ من اللاعبين، تم إلغاء اللعبة." });
    }

    let remaining = shuffle(players);

    while (remaining.length > 1) {
      const passes = Math.floor(Math.random() * remaining.length) + 3;
      let holderIndex = Math.floor(Math.random() * remaining.length);

      const passMsg = await interaction.followUp({ content: `💣 القنبلة مع <@${remaining[holderIndex]}>...`, fetchReply: true });

      for (let i = 0; i < passes; i++) {
        await delay(900);
        holderIndex = (holderIndex + 1) % remaining.length;
        await passMsg.edit({ content: `💣 القنبلة مع <@${remaining[holderIndex]}>...` });
      }

      await delay(900);
      const eliminated = remaining[holderIndex];
      remaining = remaining.filter((id) => id !== eliminated);
      await interaction.followUp({
        content: `💥 **انفجرت القنبلة عند** <@${eliminated}>! خرج من اللعبة.\n\nالمتبقون: ${
          remaining.map((id) => `<@${id}>`).join(" | ") || "-"
        }`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#57f287")
      .setTitle("🏆 انتهت اللعبة!")
      .setDescription(`الفائز: <@${remaining[0]}>`);
    return interaction.followUp({ embeds: [embed] });
  },
};
