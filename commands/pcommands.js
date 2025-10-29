const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'features', 'pcommands.json');

function loadPCommandsData() {
    try {
        const fsSync = require('fs');
        if (fsSync.existsSync(dataPath)) {
            return JSON.parse(fsSync.readFileSync(dataPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading pcommands data:', error);
    }
    return { commands: {} };
}

function savePCommandsData(data) {
    const fsSync = require('fs');
    fsSync.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

module.exports = {
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const data = loadPCommandsData();
            
            if (!data[guildId]) {
                data[guildId] = { commands: {} };
                savePCommandsData(data);
            }

            const guildCommands = data[guildId].commands;
            const commandCount = Object.keys(guildCommands).length;

            const embed = new EmbedBuilder()
                .setTitle('📋 PCommands Management Panel')
                .setColor(0x5865F2)
                .setDescription('Create and manage custom clickable commands for your server.')
                .addFields(
                    { name: '📊 Total Commands', value: `${commandCount}`, inline: true },
                    { name: '🎯 Status', value: commandCount > 0 ? '✅ Active' : '❌ No commands yet', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📝 How It Works', value: '1. Add a command with a button label\n2. Users click the button to view info\n3. Edit or remove commands anytime', inline: false }
                )
                .setFooter({ text: 'Use the buttons below to manage commands' })
                .setTimestamp();

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pcmd_add')
                        .setLabel('Add Command')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setCustomId('pcmd_edit')
                        .setLabel('Edit Command')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️')
                        .setDisabled(commandCount === 0),
                    new ButtonBuilder()
                        .setCustomId('pcmd_remove')
                        .setLabel('Remove Command')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                        .setDisabled(commandCount === 0)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pcmd_list')
                        .setLabel('View All Commands')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📋')
                        .setDisabled(commandCount === 0),
                    new ButtonBuilder()
                        .setCustomId('pcmd_preview')
                        .setLabel('Preview Panel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('👁️')
                        .setDisabled(commandCount === 0),
                    new ButtonBuilder()
                        .setCustomId('pcmd_post')
                        .setLabel('Post Panel to Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📢')
                        .setDisabled(commandCount === 0)
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        } catch (error) {
            console.error('Error in pcommands execute:', error);
            await interaction.reply({ content: '❌ An error occurred while loading PCommands panel.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        try {
            const guildId = interaction.guild.id;
            const data = loadPCommandsData();
            
            if (!data[guildId]) {
                data[guildId] = { commands: {} };
            }

            const guildCommands = data[guildId].commands;

            if (interaction.customId === 'pcmd_add') {
                const modal = new ModalBuilder()
                    .setCustomId('pcmd_modal_add')
                    .setTitle('Add New PCommand');

                const labelInput = new TextInputBuilder()
                    .setCustomId('label')
                    .setLabel('Button Label (what users see)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Example: Server Rules')
                    .setRequired(true)
                    .setMaxLength(80);

                const titleInput = new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Command Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Example: 📜 Server Rules')
                    .setRequired(true)
                    .setMaxLength(256);

                const descriptionInput = new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Command Description/Information')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Enter the full information that will be displayed...')
                    .setRequired(true)
                    .setMaxLength(4000);

                const row1 = new ActionRowBuilder().addComponents(labelInput);
                const row2 = new ActionRowBuilder().addComponents(titleInput);
                const row3 = new ActionRowBuilder().addComponents(descriptionInput);

                modal.addComponents(row1, row2, row3);
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'pcmd_edit') {
                if (Object.keys(guildCommands).length === 0) {
                    return interaction.reply({ content: '❌ No commands to edit!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('✏️ Select Command to Edit')
                    .setDescription('Click a button below to edit that command.')
                    .setColor(0x5865F2);

                // Create buttons for each command (max 25)
                const buttons = Object.entries(guildCommands).slice(0, 25).map(([id, cmd]) =>
                    new ButtonBuilder()
                        .setCustomId(`pcmd_edit_select_${id}`)
                        .setLabel(cmd.label)
                        .setStyle(ButtonStyle.Primary)
                );

                // Distribute buttons across rows (5 buttons per row max)
                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) {
                    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                    rows.push(row);
                }

                await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
                return;
            }

            if (interaction.customId === 'pcmd_list') {
                if (Object.keys(guildCommands).length === 0) {
                    return interaction.reply({ content: '❌ No commands have been added yet. Use "Add Command" to create one!', ephemeral: true });
                }

                await this.showCommandPanel(interaction, guildCommands, true);
                return;
            }

            if (interaction.customId === 'pcmd_remove') {
                if (Object.keys(guildCommands).length === 0) {
                    return interaction.reply({ content: '❌ No commands to remove!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🗑️ Select Command to Remove')
                    .setDescription('Click a button below to remove that command.')
                    .setColor(0xFF0000);

                // Create buttons for each command (max 25)
                const buttons = Object.entries(guildCommands).slice(0, 25).map(([id, cmd]) =>
                    new ButtonBuilder()
                        .setCustomId(`pcmd_remove_select_${id}`)
                        .setLabel(cmd.label)
                        .setStyle(ButtonStyle.Danger)
                );

                // Distribute buttons across rows (5 buttons per row max)
                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) {
                    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                    rows.push(row);
                }

                await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
                return;
            }

            if (interaction.customId === 'pcmd_preview') {
                await this.showCommandPanel(interaction, guildCommands, true);
                return;
            }

            if (interaction.customId === 'pcmd_post') {
                await this.showCommandPanel(interaction, guildCommands, false);
                await interaction.reply({ content: '✅ PCommands panel posted to this channel!', ephemeral: true });
                return;
            }

            // Handle edit selection button clicks
            if (interaction.customId.startsWith('pcmd_edit_select_')) {
                const commandId = interaction.customId.replace('pcmd_edit_select_', '');
                const command = guildCommands[commandId];

                if (!command) {
                    return interaction.reply({ content: '❌ Command not found.', ephemeral: true });
                }

                // Show edit modal with current values
                const editModal = new ModalBuilder()
                    .setCustomId(`pcmd_modal_edit_${commandId}`)
                    .setTitle('Edit PCommand');

                const labelInput = new TextInputBuilder()
                    .setCustomId('label')
                    .setLabel('Button Label')
                    .setStyle(TextInputStyle.Short)
                    .setValue(command.label)
                    .setRequired(true)
                    .setMaxLength(80);

                const titleInput = new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Command Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(command.title)
                    .setRequired(true)
                    .setMaxLength(256);

                const descriptionInput = new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Command Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(command.description)
                    .setRequired(true)
                    .setMaxLength(4000);

                const row1 = new ActionRowBuilder().addComponents(labelInput);
                const row2 = new ActionRowBuilder().addComponents(titleInput);
                const row3 = new ActionRowBuilder().addComponents(descriptionInput);

                editModal.addComponents(row1, row2, row3);
                await interaction.showModal(editModal);
                return;
            }

            // Handle remove selection button clicks
            if (interaction.customId.startsWith('pcmd_remove_select_')) {
                const commandId = interaction.customId.replace('pcmd_remove_select_', '');
                const command = guildCommands[commandId];

                if (!command) {
                    return interaction.reply({ content: '❌ Command not found.', ephemeral: true });
                }

                // Delete the command
                const data = loadPCommandsData();
                delete data[guildId].commands[commandId];
                savePCommandsData(data);

                await interaction.reply({ content: `✅ Command **${command.label}** removed successfully!`, ephemeral: true });
                return;
            }

            // Handle individual command button clicks
            if (interaction.customId.startsWith('pcmd_view_')) {
                const commandId = interaction.customId.replace('pcmd_view_', '');
                const command = guildCommands[commandId];

                if (!command) {
                    return interaction.reply({ content: '❌ Command not found.', ephemeral: true });
                }

                const infoEmbed = new EmbedBuilder()
                    .setTitle(command.title)
                    .setDescription(command.description)
                    .setColor(0x5865F2)
                    .setTimestamp();

                await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
                return;
            }

        } catch (error) {
            console.error('Error in pcommands button handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async handleModal(interaction) {
        try {
            const guildId = interaction.guild.id;
            const data = loadPCommandsData();

            if (interaction.customId === 'pcmd_modal_add') {
                const label = interaction.fields.getTextInputValue('label');
                const title = interaction.fields.getTextInputValue('title');
                const description = interaction.fields.getTextInputValue('description');

                // Create unique ID from label
                const commandId = label.toLowerCase().replace(/[^a-z0-9]/g, '_');

                if (!data[guildId]) {
                    data[guildId] = { commands: {} };
                }

                data[guildId].commands[commandId] = {
                    label,
                    title,
                    description,
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString()
                };

                savePCommandsData(data);
                await interaction.reply({ content: `✅ Command **${label}** added successfully!`, ephemeral: true });
                return;
            }



            if (interaction.customId.startsWith('pcmd_modal_edit_')) {
                const oldCommandId = interaction.customId.replace('pcmd_modal_edit_', '');
                const label = interaction.fields.getTextInputValue('label');
                const title = interaction.fields.getTextInputValue('title');
                const description = interaction.fields.getTextInputValue('description');

                // Create new ID from new label
                const newCommandId = label.toLowerCase().replace(/[^a-z0-9]/g, '_');

                if (!data[guildId]?.commands[oldCommandId]) {
                    return interaction.reply({ content: `❌ Original command not found!`, ephemeral: true });
                }

                const oldCommand = data[guildId].commands[oldCommandId];

                // Delete old command
                delete data[guildId].commands[oldCommandId];

                // Add updated command
                data[guildId].commands[newCommandId] = {
                    label,
                    title,
                    description,
                    createdBy: oldCommand.createdBy,
                    createdAt: oldCommand.createdAt,
                    updatedBy: interaction.user.id,
                    updatedAt: new Date().toISOString()
                };

                savePCommandsData(data);
                await interaction.reply({ content: `✅ Command **${label}** updated successfully!`, ephemeral: true });
                return;
            }



        } catch (error) {
            console.error('Error in pcommands modal handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async showCommandPanel(interaction, commands, isEphemeral) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Server Commands')
            .setDescription('Click a button below to view command information.')
            .setColor(0x5865F2)
            .setFooter({ text: `${Object.keys(commands).length} commands available` })
            .setTimestamp();

        // Create buttons (max 25 buttons across 5 rows)
        const buttons = Object.entries(commands).slice(0, 25).map(([id, cmd]) =>
            new ButtonBuilder()
                .setCustomId(`pcmd_view_${id}`)
                .setLabel(cmd.label)
                .setStyle(ButtonStyle.Primary)
        );

        // Distribute buttons across rows (5 buttons per row max)
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
            rows.push(row);
        }

        if (isEphemeral) {
            await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        } else {
            await interaction.channel.send({ embeds: [embed], components: rows });
        }
    }
};
