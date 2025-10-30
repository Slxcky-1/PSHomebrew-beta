const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderator')
        .setDescription('Open the moderation control panel (Moderator only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        // This command is handled in bot.js
        // This file exists only to register the command with Discord
    },
};
