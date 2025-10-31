const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Create and manage webhooks with custom embeds (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Handler is in bot.js
        await interaction.reply({ content: 'This command is handled in the main bot file.', ephemeral: true });
    },
};
