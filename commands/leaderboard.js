const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the richest users'),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
