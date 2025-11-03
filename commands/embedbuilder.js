const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embedbuilder')
        .setDescription('Create custom embeds with an interactive builder')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('embed_builder_modal')
            .setTitle('Embed Builder');

        const titleInput = new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter embed title')
            .setRequired(false)
            .setMaxLength(256);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter embed description')
            .setRequired(false)
            .setMaxLength(4000);

        const colorInput = new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Color (Hex Code)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., #FF5733 or 0xFF5733')
            .setRequired(false)
            .setMaxLength(10);

        const footerInput = new TextInputBuilder()
            .setCustomId('embed_footer')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter footer text')
            .setRequired(false)
            .setMaxLength(2048);

        const imageInput = new TextInputBuilder()
            .setCustomId('embed_image')
            .setLabel('Image URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/image.png')
            .setRequired(false);

        const row1 = new ActionRowBuilder().addComponents(titleInput);
        const row2 = new ActionRowBuilder().addComponents(descriptionInput);
        const row3 = new ActionRowBuilder().addComponents(colorInput);
        const row4 = new ActionRowBuilder().addComponents(footerInput);
        const row5 = new ActionRowBuilder().addComponents(imageInput);

        modal.addComponents(row1, row2, row3, row4, row5);

        await interaction.showModal(modal);
    },
};
