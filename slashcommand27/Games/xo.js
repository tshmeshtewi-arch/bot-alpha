const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  }
  if (board.every((c) => c)) return "draw";
  return null;
}

function buildBoard(board, gameOver) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`xo_${i}`)
          .setLabel(cell === "X" ? "❌" : cell === "O" ? "⭕" : "‌")
          .setStyle(cell === "X" ? ButtonStyle.Danger : cell === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(!!cell || gameOver)
      );
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xo")
    .setDescription("تيك تاك تو ضد لاعب آخر")
    .addUserOption((o) => o.setName("الخصم").setDescription("اللاعب اللي تبي تتحداه").setRequired(true)),
  async execute(interaction) {
    const opponent = interaction.options.getUser("الخصم");
    const challenger = interaction.user;

    if (opponent.bot) return interaction.reply({ content: "❗ ما تقدر تلعب ضد بوت.", ephemeral: true });
    if (opponent.id === challenger.id) return interaction.reply({ content: "❗ ما تقدر تتحدى نفسك.", ephemeral: true });

    const board = Array(9).fill(null);
    const players = { X: challenger.id, O: opponent.id };
    let turn = "X";

    const msg = await interaction.reply({
      content: `❌ ${challenger} ضد ⭕ ${opponent}\nالدور الآن: ${challenger}`,
      components: buildBoard(board, false),
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (btn) => {
      const currentPlayerId = players[turn];
      if (btn.user.id !== currentPlayerId) {
        return btn.reply({ content: "❗ مو دورك!", ephemeral: true });
      }
      const i = Number(btn.customId.split("_")[1]);
      if (board[i]) {
        return btn.reply({ content: "❗ هذا المربع محجوز.", ephemeral: true });
      }

      board[i] = turn;
      const result = checkWinner(board);

      if (result) {
        collector.stop("done");
        const embed = new EmbedBuilder()
          .setColor(result === "draw" ? "#faa61a" : "#57f287")
          .setTitle("🎮 انتهت اللعبة!")
          .setDescription(result === "draw" ? "🤝 تعادل!" : `🏆 الفائز: <@${players[result]}>`);
        return btn.update({ content: "", embeds: [embed], components: buildBoard(board, true) });
      }

      turn = turn === "X" ? "O" : "X";
      return btn.update({
        content: `❌ ${challenger} ضد ⭕ ${opponent}\nالدور الآن: <@${players[turn]}>`,
        components: buildBoard(board, false),
      });
    });

    collector.on("end", async (_collected, reason) => {
      if (reason !== "done") {
        try {
          await msg.edit({ components: buildBoard(board, true) });
        } catch (_) {}
        await interaction.followUp({ content: "⏱️ انتهى وقت اللعبة." });
      }
    });
  },
};
