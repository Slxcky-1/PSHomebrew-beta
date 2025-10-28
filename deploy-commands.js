const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
    config = require('./config.json');
    console.log('✅ Loaded configuration from config.json');
} catch (error) {
    console.error('❌ ERROR: config.json not found!');
    console.error('Please create config.json with your bot token and client ID');
    process.exit(1);
}

// Validate required configuration
if (!config.token || !config.clientId) {
    console.error('❌ ERROR: Missing required configuration!');
    console.error('config.json must contain "token" and "clientId"');
    process.exit(1);
}

// Load all feature command files
const featuresPath = path.join(__dirname, 'features');
const featureFiles = fs.readdirSync(featuresPath).filter(file => file.endsWith('.json'));

let commands = [];
for (const file of featureFiles) {
    const filePath = path.join(featuresPath, file);
    const feature = require(filePath);
    if (feature.commands) {
        commands = commands.concat(feature.commands);
    }
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('🔄 Started refreshing application (/) commands...');
        
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );
        
        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();
