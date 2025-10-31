const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('Configure the leveling system (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // This command is handled in bot.js
        // This file exists only to register the command with Discord
    },
};
