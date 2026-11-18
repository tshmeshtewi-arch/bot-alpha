const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const play = require("play-dl");
const ytdl = require("@distube/ytdl-core");
const { ytCookie } = require("../config.js");

let ytdlAgent = null;
if (ytCookie && ytCookie.length > 20 && !ytCookie.includes("الصق_الكوكيز")) {
  try {
    const cookies = ytCookie.split(";").map((pair) => {
      const idx = pair.indexOf("=");
      return {
        name: pair.slice(0, idx).trim(),
        value: pair.slice(idx + 1).trim(),
        domain: ".youtube.com",
      };
    });
    ytdlAgent = ytdl.createAgent(cookies);
  } catch (err) {
    console.error("🔴 ytdl-core createAgent error:", err);
  }
}

if (ytCookie && ytCookie.length > 20 && !ytCookie.includes("الصق_الكوكيز")) {
  play
    .setToken({
      youtube: {
        cookie: ytCookie,
      },
    })
    .catch((err) => console.error("🔴 play-dl setToken error:", err));
}

// guildId -> { connection, player, songs: [{title,url,requestedBy}], textChannel }
const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, { connection: null, player: null, songs: [], textChannel: null });
  }
  return queues.get(guildId);
}

async function ensureConnection(guild, voiceChannel) {
  let connection = getVoiceConnection(guild.id);
  if (!connection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15000).catch(() => {});
  }
  return connection;
}

async function playNext(guildId) {
  const q = getQueue(guildId);
  if (!q.songs.length) return;

  const song = q.songs[0];

  let audioStream;
  try {
    audioStream = ytdl(song.url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25,
      agent: ytdlAgent || undefined,
    });
  } catch (err) {
    console.error("🔴 ytdl-core stream error:", err);
    q.songs.shift();
    if (q.textChannel) q.textChannel.send(`❗ صار خطأ بتشغيل **${song.title}**، تم تخطيها.`).catch(() => {});
    return playNext(guildId);
  }

  audioStream.on("error", (err) => {
    console.error("🔴 ytdl-core stream runtime error:", err);
    if (q.textChannel) q.textChannel.send(`❗ صار خطأ بتشغيل **${song.title}**، تم تخطيها.`).catch(() => {});
  });

  const resource = createAudioResource(audioStream, { inputType: StreamType.Arbitrary });

  if (!q.player) {
    q.player = createAudioPlayer();
    q.connection.subscribe(q.player);

    q.player.on(AudioPlayerStatus.Idle, () => {
      q.songs.shift();
      playNext(guildId);
    });

    q.player.on("error", (err) => {
      console.error("🔴 music player error:", err);
      q.songs.shift();
      playNext(guildId);
    });
  }

  q.player.play(resource);
  if (q.textChannel) {
    q.textChannel.send(`🎶 يشتغل الآن: **${song.title}** | طلبها <@${song.requestedBy}>`).catch(() => {});
  }
}

async function resolveQuery(query) {
  if (play.yt_validate(query) === "video") {
    const details = await play.video_basic_info(query);
    const v = details.video_details;
    const url = v.url || `https://www.youtube.com/watch?v=${v.id}`;
    if (!v.id) throw new Error("NO_RESULTS");
    return { title: v.title, url };
  }

  const results = await play.search(query, { limit: 1, source: { youtube: "video" } });
  if (!results.length) throw new Error("NO_RESULTS");
  const v = results[0];
  const url = v.url || `https://www.youtube.com/watch?v=${v.id}`;
  if (!v.id) throw new Error("NO_RESULTS");
  return { title: v.title, url };
}

async function addSong({ guild, voiceChannel, textChannel, query, requestedBy }) {
  const info = await resolveQuery(query);

  const q = getQueue(guild.id);
  q.textChannel = textChannel;
  q.connection = await ensureConnection(guild, voiceChannel);

  q.songs.push({ title: info.title, url: info.url, requestedBy });

  if (q.songs.length === 1) {
    await playNext(guild.id);
  }

  return { title: info.title, position: q.songs.length };
}

function skip(guildId) {
  const q = queues.get(guildId);
  if (!q || !q.player) return false;
  q.player.stop(); // يطلق Idle اللي يشغل التالي تلقائيًا
  return true;
}

function stop(guildId) {
  const q = queues.get(guildId);
  if (!q) return false;
  q.songs = [];
  if (q.player) q.player.stop();
  return true;
}

function getQueueList(guildId) {
  const q = queues.get(guildId);
  return q ? q.songs : [];
}

module.exports = { addSong, skip, stop, getQueueList };
