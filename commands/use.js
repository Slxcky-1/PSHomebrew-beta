const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item ID to use')
                .setRequired(true)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
