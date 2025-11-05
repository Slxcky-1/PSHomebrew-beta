// Leave Message System Module// Leave Message System Module

// This functionality is integrated into bot.js// This functionality is integrated into bot.js

// This file serves as a command stub for the legacy command system// This file serves as a command stub for the legacy command system



const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');



module.exports = {module.exports = {

    data: new SlashCommandBuilder()    data: new SlashCommandBuilder()

        .setName('leave')        .setName('leave')

        .setDescription('Configure leave messages for when members leave the server')        .setDescription('Configure leave messages for when members leave the server')

        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Note: The actual leave command implementation is in bot.js (line 5757+)    // Note: The actual leave command implementation is in bot.js (line 5757+)

    // All handlers are also in bot.js    // All handlers are also in bot.js

    async execute(interaction, client) {    async execute(interaction, client) {

        // This execution is handled directly in bot.js        // This execution is handled directly in bot.js

        // See bot.js line 5757: if (interaction.commandName === 'leave')        // See bot.js line 5757: if (interaction.commandName === 'leave')

        await interaction.reply({        await interaction.reply({

            content: '⚠️ This command is handled by the main bot. Please try again.',            content: ' This command is handled by the main bot. Please try again.',

            ephemeral: true            ephemeral: true

        });        });

    }    }

};};

