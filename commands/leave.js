// Leave Message System Module
// This functionality is integrated into bot.js
// This file serves as a command stub for the legacy command system

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Configure leave messages for when members leave the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    // Note: The actual leave command implementation is in bot.js (line 5757+)
    // All handlers are also in bot.js
    async execute(interaction, client) {
        // This execution is handled directly in bot.js
        // See bot.js line 5757: if (interaction.commandName === 'leave')
        await interaction.reply({
            content: ' This command is handled by the main bot. Please try again.',
            ephemeral: true
        });
    }
};
