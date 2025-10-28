const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const ytDataPath = path.join(__dirname, '..', 'features', 'youtubeNotifications.json');

function loadYTData() {
    try {
        const fsSync = require('fs');
        return JSON.parse(fsSync.readFileSync(ytDataPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveYTData(data) {
    const fsSync = require('fs');
    fsSync.writeFileSync(ytDataPath, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('youtubenotifications')
        .setDescription('Manage YouTube channel notifications'),
    
    async execute(interaction) {
        try {
            console.log('✅ YouTube Notifications command executed by:', interaction.user.tag);
            if (!interaction.member.permissions.has('Administrator')) {
                console.log('❌ User lacks administrator permission');
                return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const ytData = loadYTData();
            console.log('📂 Loaded YouTube data for guild:', guildId);
            
            if (!ytData[guildId]) {
                console.log('🆕 Creating new YouTube config for guild:', guildId);
                ytData[guildId] = {
                    enabled: false,
                    notificationChannelId: null,
                    customMessage: '🎥 **New video from {channelName}!**\n{title}',
                    checkInterval: 600000, // 10 minutes default
                    channels: [],
                    lastChecked: {}
                };
                saveYTData(ytData);
            }

            const config = ytData[guildId];
            console.log('⚙️ Current config:', JSON.stringify(config, null, 2));
        
        const embed = new EmbedBuilder()
            .setTitle('📺 YouTube Notifications Settings')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Notification Channel', value: config.notificationChannelId ? `<#${config.notificationChannelId}>` : 'Not set', inline: true },
                { name: 'Check Interval', value: `${config.checkInterval / 60000} minutes`, inline: true },
                { name: 'Monitored Channels', value: config.channels.length > 0 ? config.channels.map(ch => `• ${ch.name} (${ch.channelId})`).join('\n') : 'None', inline: false },
                { name: 'Custom Message', value: `\`\`\`${config.customMessage}\`\`\``, inline: false }
            )
            .setFooter({ text: 'Variables: {channelName}, {title}, {url}, {description}' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('yt_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('yt_add_channel')
                    .setLabel('Add Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('yt_remove_channel')
                    .setLabel('Remove Channel')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('➖')
                    .setDisabled(config.channels.length === 0),
                new ButtonBuilder()
                    .setCustomId('yt_set_interval')
                    .setLabel('Set Interval')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('yt_set_message')
                    .setLabel('Custom Message')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✏️')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('yt_set_channel')
                    .setLabel('Set Notification Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📢')
            );

        await interaction.reply({ embeds: [embed], components: [row, row2], ephemeral: true });
        } catch (error) {
            console.error('❌ Error in YouTube execute:', error);
            console.error('Stack trace:', error.stack);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Failed to load YouTube notifications settings.', ephemeral: true });
            }
        }
    },

    async handleButton(interaction) {
        console.log('🔘 YouTube button clicked:', interaction.customId, 'by', interaction.user.tag);
        const guildId = interaction.guild.id;
        const ytData = loadYTData();
        console.log('📂 Data loaded for button interaction');
        
        if (!ytData[guildId]) {
            console.log('❌ No config found for guild:', guildId);
            return interaction.reply({ content: '❌ YouTube notifications not configured. Use `/youtubenotifications` first.', ephemeral: true });
        }

        const config = ytData[guildId];
        console.log('⚙️ Config for button:', JSON.stringify(config, null, 2));

        // Toggle enabled/disabled
        if (interaction.customId === 'yt_toggle') {
            try {
                console.log('🔄 Toggling YouTube notifications...');
                config.enabled = !config.enabled;
                saveYTData(ytData);
                console.log('✅ YouTube notifications now:', config.enabled ? 'ENABLED' : 'DISABLED');
            
            // Update the panel
            const embed = new EmbedBuilder()
                .setTitle('📺 YouTube Notifications Settings')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Notification Channel', value: config.notificationChannelId ? `<#${config.notificationChannelId}>` : 'Not set', inline: true },
                    { name: 'Check Interval', value: `${config.checkInterval / 60000} minutes`, inline: true },
                    { name: 'Monitored Channels', value: config.channels.length > 0 ? config.channels.map(ch => `• ${ch.name} (${ch.channelId})`).join('\n') : 'None', inline: false },
                    { name: 'Custom Message', value: `\`\`\`${config.customMessage}\`\`\``, inline: false }
                )
                .setFooter({ text: 'Variables: {channelName}, {title}, {url}, {description}' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('yt_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('yt_add_channel')
                        .setLabel('Add Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setCustomId('yt_remove_channel')
                        .setLabel('Remove Channel')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('➖')
                        .setDisabled(config.channels.length === 0),
                    new ButtonBuilder()
                        .setCustomId('yt_set_interval')
                        .setLabel('Set Interval')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⏱️'),
                    new ButtonBuilder()
                        .setCustomId('yt_set_message')
                        .setLabel('Custom Message')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✏️')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('yt_set_channel')
                        .setLabel('Set Notification Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📢')
                );

            await interaction.update({ embeds: [embed], components: [row, row2] });
            return;
            } catch (error) {
                console.error('❌ Error in yt_toggle:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to toggle YouTube notifications.', ephemeral: true });
                }
                return;
            }
        }

        // Add YouTube channel
        if (interaction.customId === 'yt_add_channel') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('yt_add_channel_modal')
                    .setTitle('Add YouTube Channel');

                const channelIdInput = new TextInputBuilder()
                    .setCustomId('yt_channel_id')
                    .setLabel('YouTube Channel ID')
                    .setPlaceholder('UC1234567890abcdefghij (from channel URL)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const channelNameInput = new TextInputBuilder()
                    .setCustomId('yt_channel_name')
                    .setLabel('Channel Name (for display)')
                    .setPlaceholder('e.g., Linus Tech Tips')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelIdInput),
                    new ActionRowBuilder().addComponents(channelNameInput)
                );

                return interaction.showModal(modal);
            } catch (error) {
                console.error('❌ Error showing add channel modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to open channel form.', ephemeral: true });
                }
                return;
            }
        }

        // Remove YouTube channel
        if (interaction.customId === 'yt_remove_channel') {
            try {
                if (config.channels.length === 0) {
                    return interaction.reply({ content: '❌ No channels to remove.', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('yt_remove_channel_modal')
                    .setTitle('Remove YouTube Channel');

                const channelListText = config.channels.map((ch, i) => `${i + 1}. ${ch.name}`).join('\n');
                
                const channelNumberInput = new TextInputBuilder()
                    .setCustomId('yt_channel_number')
                    .setLabel(`Select channel number to remove (1-${config.channels.length})`)
                    .setPlaceholder('Enter number')
                    .setValue(channelListText)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(channelNumberInput));
                return interaction.showModal(modal);
            } catch (error) {
                console.error('❌ Error showing remove channel modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to open removal form.', ephemeral: true });
                }
                return;
            }
        }

        // Set check interval
        if (interaction.customId === 'yt_set_interval') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('yt_set_interval_modal')
                    .setTitle('Set Check Interval');

                const intervalInput = new TextInputBuilder()
                    .setCustomId('yt_interval')
                    .setLabel('Check interval in minutes (5-60)')
                    .setPlaceholder('10')
                    .setValue((config.checkInterval / 60000).toString())
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(intervalInput));
                return interaction.showModal(modal);
            } catch (error) {
                console.error('❌ Error showing interval modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to open interval form.', ephemeral: true });
                }
                return;
            }
        }

        // Set custom message
        if (interaction.customId === 'yt_set_message') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('yt_set_message_modal')
                    .setTitle('Set Custom Message');

                const messageInput = new TextInputBuilder()
                    .setCustomId('yt_message')
                    .setLabel('Custom notification message')
                    .setPlaceholder('{channelName}, {title}, {url}, {description}')
                    .setValue(config.customMessage)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
                return interaction.showModal(modal);
            } catch (error) {
                console.error('❌ Error showing message modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to open message form.', ephemeral: true });
                }
                return;
            }
        }

        // Set notification channel
        if (interaction.customId === 'yt_set_channel') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('yt_set_channel_modal')
                    .setTitle('Set Notification Channel');

                const channelInput = new TextInputBuilder()
                    .setCustomId('yt_discord_channel_id')
                    .setLabel('Discord Channel ID')
                    .setPlaceholder('Right-click channel > Copy Channel ID')
                    .setValue(config.notificationChannelId || '')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
                return interaction.showModal(modal);
            } catch (error) {
                console.error('❌ Error showing channel modal:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Failed to open channel form.', ephemeral: true });
                }
                return;
            }
        }
    },

    async handleModal(interaction) {
        try {
            const guildId = interaction.guild.id;
            const ytData = loadYTData();
            
            if (!ytData[guildId]) {
                return interaction.reply({ content: '❌ Configuration error.', ephemeral: true });
            }

            const config = ytData[guildId];

            // Add channel modal
            if (interaction.customId === 'yt_add_channel_modal') {
                const channelId = interaction.fields.getTextInputValue('yt_channel_id').trim();
                const channelName = interaction.fields.getTextInputValue('yt_channel_name').trim();

                if (config.channels.some(ch => ch.channelId === channelId)) {
                    return interaction.reply({ content: '❌ This channel is already being monitored.', ephemeral: true });
                }

                config.channels.push({ channelId, name: channelName });
                saveYTData(ytData);
                return interaction.reply({ content: `✅ Added YouTube channel **${channelName}** (${channelId})`, ephemeral: true });
            }

            // Remove channel modal
            if (interaction.customId === 'yt_remove_channel_modal') {
                const input = interaction.fields.getTextInputValue('yt_channel_number').trim();
                const lines = input.split('\n');
                const numberLine = lines.find(line => /^\d+$/.test(line.trim()));
                
                if (!numberLine) {
                    return interaction.reply({ content: '❌ Please enter just the number of the channel to remove.', ephemeral: true });
                }

                const channelNumber = parseInt(numberLine.trim());

                if (isNaN(channelNumber) || channelNumber < 1 || channelNumber > config.channels.length) {
                    return interaction.reply({ content: `❌ Invalid number. Must be between 1 and ${config.channels.length}.`, ephemeral: true });
                }

                const removed = config.channels.splice(channelNumber - 1, 1)[0];
                saveYTData(ytData);
                return interaction.reply({ content: `✅ Removed YouTube channel **${removed.name}**`, ephemeral: true });
            }

        // Set interval modal
        if (interaction.customId === 'yt_set_interval_modal') {
            const minutes = parseInt(interaction.fields.getTextInputValue('yt_interval').trim());

            if (isNaN(minutes) || minutes < 5 || minutes > 60) {
                return interaction.reply({ content: '❌ Interval must be between 5 and 60 minutes.', ephemeral: true });
            }

            config.checkInterval = minutes * 60000;
            saveYTData(ytData);
            return interaction.reply({ content: `✅ Check interval set to ${minutes} minutes.`, ephemeral: true });
        }

        // Set custom message modal
        if (interaction.customId === 'yt_set_message_modal') {
            const message = interaction.fields.getTextInputValue('yt_message').trim();

            if (!message) {
                return interaction.reply({ content: '❌ Message cannot be empty.', ephemeral: true });
            }

            config.customMessage = message;
            saveYTData(ytData);
            return interaction.reply({ content: `✅ Custom message updated!`, ephemeral: true });
        }

        // Set notification channel modal
        if (interaction.customId === 'yt_set_channel_modal') {
            const channelId = interaction.fields.getTextInputValue('yt_discord_channel_id').trim();

            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel || channel.type !== ChannelType.GuildText) {
                return interaction.reply({ content: '❌ Invalid channel ID or channel is not a text channel.', ephemeral: true });
            }

            config.notificationChannelId = channelId;
            saveYTData(ytData);
            return interaction.reply({ content: `✅ Notification channel set to <#${channelId}>`, ephemeral: true });
        }
        } catch (error) {
            console.error('❌ Error in handleModal:', error);
            console.error('Stack trace:', error.stack);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred processing the form.', ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '❌ An error occurred processing the form.' });
            }
        }
    }
};
