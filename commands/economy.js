const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Economy system control panel'),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
