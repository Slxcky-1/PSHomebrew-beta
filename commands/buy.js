const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Item ID to buy')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('Quantity to buy')
                .setRequired(false)
                .setMinValue(1)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
