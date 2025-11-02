const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn money'),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
