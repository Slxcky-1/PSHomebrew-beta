const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your inventory')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to check inventory')
                .setRequired(false)),
    
    async execute(interaction) {
        // This command is handled in bot.js
    },
};
