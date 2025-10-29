const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'serverSettings.json');

function loadSettings() {
    try {
        const fsSync = require('fs');
        return JSON.parse(fsSync.readFileSync(settingsPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(data) {
    const fsSync = require('fs');
    fsSync.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

module.exports = {
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const settings = loadSettings();
            
            if (!settings[guildId]) {
                settings[guildId] = {};
            }
            
            if (!settings[guildId].leave) {
                settings[guildId].leave = {
                    enabled: false,
                    channelName: 'general',
                    customMessage: null
                };
                saveSettings(settings);
            }

            const config = settings[guildId].leave;
            
            const currentChannel = config.channelName || 'general';
            const hasCustomMessage = config.customMessage ? 'Yes' : 'No';

            const embed = new EmbedBuilder()
                .setTitle('👋 Leave Message Settings')
                .setColor(0xFF0000)
                .setDescription('Configure leave messages for when members leave the server.')
                .addFields(
                    { name: '🔘 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '📢 Channel', value: `#${currentChannel}`, inline: true },
                    { name: '✏️ Custom Message', value: hasCustomMessage, inline: true },
                    { name: '📝 Available Variables', value: '`{user}` - User tag\n`{server}` - Server name\n`{memberCount}` - Total members', inline: false }
                )
                .setFooter({ text: 'Use the buttons below to configure settings' })
                .setTimestamp();

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leave_toggle')
                        .setLabel(config.enabled ? 'Disable System' : 'Enable System')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '❌' : '✅'),
                    new ButtonBuilder()
                        .setCustomId('leave_set_channel')
                        .setLabel('Set Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📢'),
                    new ButtonBuilder()
                        .setCustomId('leave_set_message')
                        .setLabel('Set Custom Message')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leave_reset_message')
                        .setLabel('Reset to Default Message')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setCustomId('leave_test')
                        .setLabel('Send Test Message')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🧪')
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        } catch (error) {
            console.error('Error in leavesetup execute:', error);
            await interaction.reply({ content: '❌ An error occurred while loading leave setup.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        try {
            const guildId = interaction.guild.id;
            const settings = loadSettings();
            
            if (!settings[guildId] || !settings[guildId].leave) {
                settings[guildId] = settings[guildId] || {};
                settings[guildId].leave = {
                    enabled: false,
                    channelName: 'general',
                    customMessage: null
                };
            }

            const config = settings[guildId].leave;

            if (interaction.customId === 'leave_toggle') {
                config.enabled = !config.enabled;
                saveSettings(settings);
                await this.updatePanel(interaction, settings);
                return;
            }

            if (interaction.customId === 'leave_set_channel') {
                const modal = new ModalBuilder()
                    .setCustomId('leave_modal_channel')
                    .setTitle('Set Leave Channel');

                const channelInput = new TextInputBuilder()
                    .setCustomId('channel')
                    .setLabel('Channel Name or ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('general or 1234567890123456789')
                    .setValue(config.channelName || '')
                    .setRequired(true)
                    .setMaxLength(100);

                const row = new ActionRowBuilder().addComponents(channelInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'leave_set_message') {
                const modal = new ModalBuilder()
                    .setCustomId('leave_modal_message')
                    .setTitle('Set Custom Leave Message');

                const messageInput = new TextInputBuilder()
                    .setCustomId('message')
                    .setLabel('Custom Leave Message')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Example: {user} has left {server}. We now have {memberCount} members.')
                    .setValue(config.customMessage || '')
                    .setRequired(true)
                    .setMaxLength(500);

                const row = new ActionRowBuilder().addComponents(messageInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'leave_reset_message') {
                config.customMessage = null;
                saveSettings(settings);
                await interaction.reply({ content: '✅ Leave message reset to default!', ephemeral: true });
                return;
            }

            if (interaction.customId === 'leave_test') {
                const leaveChannel = interaction.guild.channels.cache.find(ch => ch.name === config.channelName);
                
                if (!leaveChannel) {
                    return interaction.reply({ content: `❌ Channel #${config.channelName} not found!`, ephemeral: true });
                }

                const description = config.customMessage 
                    ? config.customMessage
                        .replace('{user}', interaction.user.tag)
                        .replace('{server}', interaction.guild.name)
                        .replace('{memberCount}', interaction.guild.memberCount.toString())
                    : `${interaction.user.tag} has left the server. We'll miss you!`;

                const testEmbed = new EmbedBuilder()
                    .setTitle('👋 Goodbye! (TEST)')
                    .setDescription(description)
                    .setColor(0xFF0000)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setFooter({ text: 'This is a test message' })
                    .setTimestamp();

                await leaveChannel.send({ embeds: [testEmbed] });
                await interaction.reply({ content: '✅ Test message sent!', ephemeral: true });
                return;
            }

        } catch (error) {
            console.error('Error in leavesetup button handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async handleModal(interaction) {
        try {
            const guildId = interaction.guild.id;
            const settings = loadSettings();

            if (interaction.customId === 'leave_modal_channel') {
                let channelInput = interaction.fields.getTextInputValue('channel').trim();
                
                // Check if it's a channel ID (numeric)
                let channelName = channelInput;
                if (/^\d+$/.test(channelInput)) {
                    // It's an ID, fetch the channel
                    const channel = await interaction.guild.channels.fetch(channelInput).catch(() => null);
                    if (!channel) {
                        return interaction.reply({ 
                            content: `❌ Channel with ID \`${channelInput}\` not found!`, 
                            ephemeral: true 
                        });
                    }
                    channelName = channel.name;
                } else {
                    // It's a name, verify it exists
                    const channel = interaction.guild.channels.cache.find(c => c.name === channelInput);
                    if (!channel) {
                        return interaction.reply({ 
                            content: `❌ Channel \`#${channelInput}\` not found!`, 
                            ephemeral: true 
                        });
                    }
                }
                
                settings[guildId].leave.channelName = channelName;
                saveSettings(settings);
                await interaction.reply({ content: `✅ Leave channel set to **#${channelName}**!`, ephemeral: true });
            }
            else if (interaction.customId === 'leave_modal_message') {
                const message = interaction.fields.getTextInputValue('message');
                settings[guildId].leave.customMessage = message;
                saveSettings(settings);
                await interaction.reply({ content: '✅ Custom leave message saved!', ephemeral: true });
            }
        } catch (error) {
            console.error('Error in leavesetup modal handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },



    async updatePanel(interaction, settings) {
        const config = settings[interaction.guild.id].leave;
        
        const currentChannel = config.channelName || 'general';
        const hasCustomMessage = config.customMessage ? 'Yes' : 'No';

        const embed = new EmbedBuilder()
            .setTitle('👋 Leave Message Settings')
            .setColor(0xFF0000)
            .setDescription('Configure leave messages for when members leave the server.')
            .addFields(
                { name: '🔘 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '📢 Channel', value: `#${currentChannel}`, inline: true },
                { name: '✏️ Custom Message', value: hasCustomMessage, inline: true },
                { name: '📝 Available Variables', value: '`{user}` - User tag\n`{server}` - Server name\n`{memberCount}` - Total members', inline: false }
            )
            .setFooter({ text: 'Use the buttons below to configure settings' })
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leave_toggle')
                    .setLabel(config.enabled ? 'Disable System' : 'Enable System')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '❌' : '✅'),
                new ButtonBuilder()
                    .setCustomId('leave_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('leave_set_message')
                    .setLabel('Set Custom Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leave_reset_message')
                    .setLabel('Reset to Default Message')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('leave_test')
                    .setLabel('Send Test Message')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🧪')
            );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }
};
