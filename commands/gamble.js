const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your money')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Game to play')
                .setRequired(true)
                .addChoices(
                    { name: 'Coinflip', value: 'coinflip' },
                    { name: 'Dice Roll', value: 'dice' },
                    { name: 'Slots', value: 'slots' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to bet')
                .setRequired(true)
                .setMinValue(10)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
