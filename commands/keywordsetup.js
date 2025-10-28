const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
            
            if (!settings[guildId].keywords) {
                settings[guildId].keywords = {
                    enabled: false,
                    ps3Enabled: true,
                    ps4Enabled: true,
                    channelName: 'general'
                };
                saveSettings(settings);
            }

            const config = settings[guildId].keywords;
            
            const currentChannel = config.channelName || 'general';

            const embed = new EmbedBuilder()
                .setTitle('🚨 Keyword Detection Settings')
                .setColor(0xFF6B00)
                .setDescription('Configure automatic error code detection and responses.')
                .addFields(
                    { name: '🔘 System Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '📢 Channel', value: `#${currentChannel}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🎮 PS3 Error Codes', value: config.ps3Enabled !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '🎮 PS4 Error Codes', value: config.ps4Enabled !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📝 How It Works', value: 'When a user mentions an error code (e.g., 80010017 or CE-34878-0), the bot automatically sends the error description and solution.', inline: false }
                )
                .setFooter({ text: 'Use the buttons below to configure settings' })
                .setTimestamp();

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('keyword_toggle')
                        .setLabel(config.enabled ? 'Disable System' : 'Enable System')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '❌' : '✅'),
                    new ButtonBuilder()
                        .setCustomId('keyword_toggle_ps3')
                        .setLabel(config.ps3Enabled !== false ? 'Disable PS3' : 'Enable PS3')
                        .setStyle(config.ps3Enabled !== false ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setEmoji('🎮'),
                    new ButtonBuilder()
                        .setCustomId('keyword_toggle_ps4')
                        .setLabel(config.ps4Enabled !== false ? 'Disable PS4' : 'Enable PS4')
                        .setStyle(config.ps4Enabled !== false ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setEmoji('🎮')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('keyword_set_channel')
                        .setLabel('Set Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📢'),
                    new ButtonBuilder()
                        .setCustomId('keyword_test_ps3')
                        .setLabel('Test PS3 Code')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🧪'),
                    new ButtonBuilder()
                        .setCustomId('keyword_test_ps4')
                        .setLabel('Test PS4 Code')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🧪')
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        } catch (error) {
            console.error('Error in keywordsetup execute:', error);
            await interaction.reply({ content: '❌ An error occurred while loading keyword setup.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        try {
            const guildId = interaction.guild.id;
            const settings = loadSettings();
            
            if (!settings[guildId] || !settings[guildId].keywords) {
                settings[guildId] = settings[guildId] || {};
                settings[guildId].keywords = {
                    enabled: false,
                    ps3Enabled: true,
                    ps4Enabled: true,
                    channelName: 'general'
                };
            }

            const config = settings[guildId].keywords;

            if (interaction.customId === 'keyword_toggle') {
                config.enabled = !config.enabled;
                saveSettings(settings);
                await this.updatePanel(interaction, settings);
                return;
            }

            if (interaction.customId === 'keyword_toggle_ps3') {
                config.ps3Enabled = config.ps3Enabled === false ? true : false;
                saveSettings(settings);
                await this.updatePanel(interaction, settings);
                return;
            }

            if (interaction.customId === 'keyword_toggle_ps4') {
                config.ps4Enabled = config.ps4Enabled === false ? true : false;
                saveSettings(settings);
                await this.updatePanel(interaction, settings);
                return;
            }

            if (interaction.customId === 'keyword_set_channel') {
                const modal = new ModalBuilder()
                    .setCustomId('keyword_modal_channel')
                    .setTitle('Set Keyword Detection Channel');

                const channelInput = new TextInputBuilder()
                    .setCustomId('channel')
                    .setLabel('Channel Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('general')
                    .setValue(config.channelName || 'general')
                    .setRequired(true)
                    .setMaxLength(100);

                const row = new ActionRowBuilder().addComponents(channelInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'keyword_test_ps3') {
                const keywordChannel = interaction.guild.channels.cache.find(ch => ch.name === config.channelName);
                
                if (!keywordChannel) {
                    return interaction.reply({ content: `❌ Channel #${config.channelName} not found!`, ephemeral: true });
                }

                const ps3ErrorCodes = require('../features/ps3ErrorCodes.json');
                const testCode = '80010017'; // Common PS3 error code
                const description = ps3ErrorCodes[testCode] || 'Error code description not found.';

                const testEmbed = new EmbedBuilder()
                    .setTitle(`🎮 PS3 Error Code: ${testCode} (TEST)`)
                    .setDescription(description)
                    .setColor(0x0066FF)
                    .setFooter({ text: 'This is a test message • PlayStation 3 Error Database' })
                    .setTimestamp();

                await keywordChannel.send({ embeds: [testEmbed] });
                await interaction.reply({ content: '✅ Test PS3 error message sent!', ephemeral: true });
                return;
            }

            if (interaction.customId === 'keyword_test_ps4') {
                const keywordChannel = interaction.guild.channels.cache.find(ch => ch.name === config.channelName);
                
                if (!keywordChannel) {
                    return interaction.reply({ content: `❌ Channel #${config.channelName} not found!`, ephemeral: true });
                }

                const ps4ErrorCodes = require('../features/ps4ErrorCodes.json');
                const testCode = 'CE-34878-0'; // Common PS4 error code
                const description = ps4ErrorCodes[testCode] || 'Error code description not found.';

                const testEmbed = new EmbedBuilder()
                    .setTitle(`🎮 PS4 Error Code: ${testCode} (TEST)`)
                    .setDescription(description)
                    .setColor(0x003087)
                    .setFooter({ text: 'This is a test message • PlayStation 4 Error Database' })
                    .setTimestamp();

                await keywordChannel.send({ embeds: [testEmbed] });
                await interaction.reply({ content: '✅ Test PS4 error message sent!', ephemeral: true });
                return;
            }

        } catch (error) {
            console.error('Error in keywordsetup button handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async handleModal(interaction) {
        try {
            const guildId = interaction.guild.id;
            const settings = loadSettings();

            if (interaction.customId === 'keyword_modal_channel') {
                const channelName = interaction.fields.getTextInputValue('channel');
                
                // Verify channel exists
                const channel = interaction.guild.channels.cache.find(ch => ch.name === channelName);
                if (!channel) {
                    return interaction.reply({ content: `❌ Channel #${channelName} not found!`, ephemeral: true });
                }

                settings[guildId].keywords.channelName = channelName;
                saveSettings(settings);
                await interaction.reply({ content: `✅ Keyword detection channel set to #${channelName}`, ephemeral: true });
            }
        } catch (error) {
            console.error('Error in keywordsetup modal handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async updatePanel(interaction, settings) {
        const config = settings[interaction.guild.id].keywords;
        
        const currentChannel = config.channelName || 'general';

        const embed = new EmbedBuilder()
            .setTitle('🚨 Keyword Detection Settings')
            .setColor(0xFF6B00)
            .setDescription('Configure automatic error code detection and responses.')
            .addFields(
                { name: '🔘 System Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '📢 Channel', value: `#${currentChannel}`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '🎮 PS3 Error Codes', value: config.ps3Enabled !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '🎮 PS4 Error Codes', value: config.ps4Enabled !== false ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '📝 How It Works', value: 'When a user mentions an error code (e.g., 80010017 or CE-34878-0), the bot automatically sends the error description and solution.', inline: false }
            )
            .setFooter({ text: 'Use the buttons below to configure settings' })
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('keyword_toggle')
                    .setLabel(config.enabled ? 'Disable System' : 'Enable System')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '❌' : '✅'),
                new ButtonBuilder()
                    .setCustomId('keyword_toggle_ps3')
                    .setLabel(config.ps3Enabled !== false ? 'Disable PS3' : 'Enable PS3')
                    .setStyle(config.ps3Enabled !== false ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setEmoji('🎮'),
                new ButtonBuilder()
                    .setCustomId('keyword_toggle_ps4')
                    .setLabel(config.ps4Enabled !== false ? 'Disable PS4' : 'Enable PS4')
                    .setStyle(config.ps4Enabled !== false ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setEmoji('🎮')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('keyword_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('keyword_test_ps3')
                    .setLabel('Test PS3 Code')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🧪'),
                new ButtonBuilder()
                    .setCustomId('keyword_test_ps4')
                    .setLabel('Test PS4 Code')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🧪')
            );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }
};
