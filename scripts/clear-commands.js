const { REST, Routes } = require('discord.js');
const config = require('./config.json');

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('🗑️ Deleting all global commands...');
        
        // Delete all global commands
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: [] }
        );
        
        console.log('✅ Successfully deleted all global commands!');
        console.log('Now run: node deploy-commands.js');
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
