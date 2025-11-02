const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to rob')
                .setRequired(true)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
