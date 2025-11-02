const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
