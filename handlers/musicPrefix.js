const music = require("../Music/musicManager");
const { prefix } = require("../config.js");

module.exports = (client27) => {
  client27.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    const content = message.content.trim();

    if (content.startsWith(`${prefix}play`)) {
      const query = content.slice(`${prefix}play`.length).trim();
      if (!query) return message.reply("❗ اكتب رابط يوتيوب أو اسم الأغنية بعد الأمر.");

      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) return message.reply("❗ لازم تكون داخل روم صوتي عشان تشغل أغنية.");

      try {
        const result = await music.addSong({
          guild: message.guild,
          voiceChannel,
          textChannel: message.channel,
          query,
          requestedBy: message.author.id,
        });
        return message.reply(
          result.position === 1
            ? `🎶 يشتغل الآن: **${result.title}**`
            : `➕ تمت الإضافة للطابور (#${result.position}): **${result.title}**`
        );
      } catch (err) {
        console.error("🔴 !play error:", err);
        return message.reply("❗ ما قدرت ألقى أو أشغل هذي الأغنية.");
      }
    }

    if (content === `${prefix}skip`) {
      const done = music.skip(message.guild.id);
      return message.reply(done ? "⏭️ تم تخطي الأغنية." : "❗ ما فيه أغنية شغالة حاليًا.");
    }

    if (content === `${prefix}stop`) {
      const done = music.stop(message.guild.id);
      return message.reply(done ? "⏹️ تم إيقاف التشغيل وتفريغ الطابور." : "❗ ما فيه أغنية شغالة حاليًا.");
    }

    if (content === `${prefix}queue`) {
      const list = music.getQueueList(message.guild.id);
      if (!list.length) return message.reply("📭 الطابور فاضي.");
      return message.reply(`📜 **الطابور:**\n${list.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}`);
    }
  });
};
