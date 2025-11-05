const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
    config = require('../config.json');
    console.log('✅ Loaded configuration from config.json');
} catch (error) {
    console.error('❌ Error: Could not load config.json!');
    console.error('Please ensure config.json exists and contains valid "token" and "clientId" properties.');
    process.exit(1);
}

// Validate required config properties
if (!config.token || !config.clientId) {
    console.error('❌ Error: Configuration is missing required properties!');
    console.error('The config.json must contain "token" and "clientId" properties.');
    process.exit(1);
}

// Load all commands from features directory
const featuresPath = path.join(__dirname, '../features');
const featureFiles = fs.readdirSync(featuresPath).filter(file => file.endsWith('.json'));

let commands = [];
for (const file of featureFiles) {
    const filePath = path.join(featuresPath, file);
    const feature = require(filePath);
    
    if (feature.commands) {
        commands = commands.concat(feature.commands);
    }
}

// Initialize REST client with Discord API
const rest = new REST({ version: '10' }).setToken(config.token);

// Deploy commands
(async () => {
    try {
        console.log(`🔄 Started refreshing application (/) commands...`);

        // Register commands with Discord
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();
