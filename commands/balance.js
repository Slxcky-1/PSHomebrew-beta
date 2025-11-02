const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or someone\'s balance')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to check balance')
                .setRequired(false)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
