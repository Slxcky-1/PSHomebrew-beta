const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Transfer money to another user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to pay')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to transfer')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
