const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('keyword')
        .setDescription('Manage keyword detection system (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // This command is handled in bot.js
        // This file exists only to register the command with Discord
    },
};
