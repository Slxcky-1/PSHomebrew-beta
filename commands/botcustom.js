const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botcustom')
        .setDescription('Customize bot name for this server (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('name')
                .setDescription('Set a custom bot nickname for this server')
                .addStringOption(option =>
                    option.setName('nickname')
                        .setDescription('Bot nickname (leave empty to reset to default)')
                        .setRequired(false)
                        .setMaxLength(32)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current bot customization')),
    
    async execute(interaction) {
        // This command is handled in bot.js
        // This file exists only to register the command with Discord
    },
};
