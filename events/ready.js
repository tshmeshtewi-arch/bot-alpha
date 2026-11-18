const { Events, ActivityType } = require('discord.js');
const { Database } = require('st.db');
const protectDB = new Database('/Json-db/Bots/protectDB.json');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🐺 UniBot متصل باسم ${client.user.tag}`);

    // تحديث الحالة
    let i = 0;
    const statuses = [
      { name: '🐺 يراقب القطيع', type: ActivityType.Watching },
      { name: '!help | UniBot Alpha', type: ActivityType.Listening },
      { name: `over ${client.guilds.cache.size} servers`, type: ActivityType.Watching }
    ];
    setInterval(() => {
      const s = statuses[i % statuses.length];
      client.user.setPresence({ activities: [{ name: s.name, type: s.type }], status: 'online' });
      i++;
    }, 30000);
  }
};
