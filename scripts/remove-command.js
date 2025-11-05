const { REST, Routes } = require('discord.js');
const fs = require('fs');

(async () => {
  const name = (process.argv[2] || '').trim() || 'level';

  // Load config
  let config;
  try {
    config = require('./config.json');
  } catch (e) {
    console.error('Failed to load config.json. Ensure token and clientId are set.');
    process.exit(1);
  }
  if (!config.token || !config.clientId) {
    console.error('Missing required config fields: token and clientId.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  const removed = { global: null, guilds: [] };

  try {
    // Remove global command with this name (if present)
    const globalCmds = await rest.get(Routes.applicationCommands(config.clientId));
    const targetGlobal = globalCmds.find(c => c.name === name);
    if (targetGlobal) {
      await rest.delete(Routes.applicationCommand(config.clientId, targetGlobal.id));
      removed.global = targetGlobal.id;
      console.log(`✅ Removed global command '/${name}' (id: ${targetGlobal.id})`);
    } else {
      console.log(`ℹ️ No global '/${name}' command found.`);
    }
  } catch (err) {
    console.error('Error while removing global command:', err?.message || err);
  }

  // Collect known guild IDs (add more if needed)
  const guildIds = new Set();
  if (config.testGuildId && /\d{17,19}/.test(config.testGuildId)) guildIds.add(config.testGuildId);
  if (config.sellhubGuildId && /\d{17,19}/.test(config.sellhubGuildId)) guildIds.add(config.sellhubGuildId);
  if (process.env.GUILD_ID && /\d{17,19}/.test(process.env.GUILD_ID)) guildIds.add(process.env.GUILD_ID);

  for (const gid of guildIds) {
    try {
      const cmds = await rest.get(Routes.applicationGuildCommands(config.clientId, gid));
      const target = cmds.find(c => c.name === name);
      if (target) {
        await rest.delete(Routes.applicationGuildCommand(config.clientId, gid, target.id));
        removed.guilds.push({ guildId: gid, id: target.id });
        console.log(`✅ Removed guild command '/${name}' in ${gid} (id: ${target.id})`);
      } else {
        console.log(`ℹ️ No '/${name}' command found in guild ${gid}.`);
      }
    } catch (err) {
      console.error(`Error while removing command in guild ${gid}:`, err?.message || err);
    }
  }

  // Optional summary output file
  try {
    fs.writeFileSync('./removed-commands.json', JSON.stringify(removed, null, 2));
  } catch {}

  console.log('Done.');
})();
