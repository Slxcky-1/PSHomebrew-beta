const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poweroptions')
        .setDescription('Bot power management panel (Owner only)'),
    
    async execute(interaction) {
        // This command is handled in bot.js
        // This file exists only to register the command with Discord
    },
};
