const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('View the item shop'),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
