const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create an interactive poll with multiple options')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Poll duration')
                .setRequired(true)
                .addChoices(
                    { name: '1 hour', value: '1h' },
                    { name: '6 hours', value: '6h' },
                    { name: '12 hours', value: '12h' },
                    { name: '24 hours', value: '24h' },
                    { name: '3 days', value: '3d' },
                    { name: '1 week', value: '1w' }
                )),
    async execute(interaction) {
        // Show modal for poll details
        const modal = new ModalBuilder()
            .setCustomId('poll_create_modal')
            .setTitle('Create a Poll');

        const questionInput = new TextInputBuilder()
            .setCustomId('poll_question')
            .setLabel('Poll Question')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What is your favorite PlayStation console?')
            .setRequired(true)
            .setMaxLength(200);

        const optionsInput = new TextInputBuilder()
            .setCustomId('poll_options')
            .setLabel('Options (one per line, max 10)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('PS3\nPS4\nPS5\nPSP\nPS Vita')
            .setRequired(true)
            .setMaxLength(500);

        const row1 = new ActionRowBuilder().addComponents(questionInput);
        const row2 = new ActionRowBuilder().addComponents(optionsInput);

        modal.addComponents(row1, row2);
        await interaction.showModal(modal);

        // Store duration for later
        if (!global.pollDurations) global.pollDurations = {};
        global.pollDurations[interaction.user.id] = interaction.options.getString('duration');
    }
};
