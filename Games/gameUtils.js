const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Runs a "join lobby" phase: posts an embed with a join button + a force-start
 * button (only usable by whoever ran the command), collects unique user ids
 * for `seconds`, then returns them.
 */
async function joinPhase(
  interaction,
  { title, description, min = 2, max = 10, seconds = 20, joinLabel = "🎮 انضمام", startLabel = "▶️ ابدأ الآن" }
) {
  const players = new Set([interaction.user.id]);

  const joinBtn = new ButtonBuilder().setCustomId("game_join").setLabel(joinLabel).setStyle(ButtonStyle.Success);
  const startBtn = new ButtonBuilder().setCustomId("game_start").setLabel(startLabel).setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(joinBtn, startBtn);

  const buildEmbed = () =>
    new EmbedBuilder()
      .setColor("#2f3136")
      .setTitle(title)
      .setDescription(
        `${description}\n\n**اللاعبون المنضمون (${players.size}/${max}):**\n${
          [...players].map((id) => `<@${id}>`).join("\n") || "لا أحد بعد"
        }`
      )
      .setFooter({ text: `ينتهي التسجيل خلال ${seconds} ثانية | الحد الأدنى ${min} لاعبين` });

  const msg = await interaction.reply({ embeds: [buildEmbed()], components: [row], fetchReply: true });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({ time: seconds * 1000 });

    collector.on("collect", async (btn) => {
      if (btn.customId === "game_join") {
        if (players.has(btn.user.id)) {
          return btn.reply({ content: "❗ أنت منضم بالفعل.", ephemeral: true });
        }
        if (players.size >= max) {
          return btn.reply({ content: "❗ اكتمل عدد اللاعبين المسموح.", ephemeral: true });
        }
        players.add(btn.user.id);
        return btn.update({ embeds: [buildEmbed()] });
      }

      if (btn.customId === "game_start") {
        if (btn.user.id !== interaction.user.id) {
          return btn.reply({ content: "❗ فقط منشئ اللعبة يقدر يبدأها الآن.", ephemeral: true });
        }
        if (players.size < min) {
          return btn.reply({ content: `❗ تحتاج ${min} لاعبين على الأقل.`, ephemeral: true });
        }
        collector.stop("forced");
        return btn.deferUpdate();
      }
    });

    collector.on("end", async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(joinBtn).setDisabled(true),
        ButtonBuilder.from(startBtn).setDisabled(true)
      );
      try {
        await msg.edit({ components: [disabledRow] });
      } catch (_) {}
      resolve({ players: [...players], message: msg });
    });
  });
}

module.exports = { shuffle, delay, joinPhase };
