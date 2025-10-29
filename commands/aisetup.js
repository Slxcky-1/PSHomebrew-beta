const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'serverSettings.json');

function loadSettings() {
    const fsSync = require('fs');
    if (fsSync.existsSync(settingsPath)) {
        return JSON.parse(fsSync.readFileSync(settingsPath, 'utf8'));
    }
    return {};
}

function saveSettings(settings) {
    const fsSync = require('fs');
    fsSync.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getGuildSettings(guildId) {
    const settings = loadSettings();
    if (!settings[guildId]) {
        settings[guildId] = {
            ai: {
                enabled: false,
                model: 'gpt-4o-mini',
                systemPrompt: 'You are a helpful PlayStation homebrew assistant.',
                temperature: 0.7,
                maxHistory: 10
            }
        };
        saveSettings(settings);
    }
    if (!settings[guildId].ai) {
        settings[guildId].ai = {
            enabled: false,
            model: 'gpt-4o-mini',
            systemPrompt: 'You are a helpful PlayStation homebrew assistant.',
            temperature: 0.7,
            maxHistory: 10
        };
        saveSettings(settings);
    }
    return settings[guildId];
}

module.exports = {
    async execute(interaction) {
        try {
            if (!interaction.member.permissions.has('Administrator')) {
                return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const settings = getGuildSettings(guildId);
            const config = settings.ai;

            const embed = new EmbedBuilder()
                .setTitle('🤖 AI Chat Settings')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .setDescription(
                    `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                    `Configure AI chat responses and behavior.`
                )
                .addFields(
                    { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '🤖 Model', value: config.model || 'gpt-4o-mini', inline: true },
                    { name: '🌡️ Temperature', value: `${config.temperature || 0.7}`, inline: true },
                    { name: '📝 System Prompt', value: (config.systemPrompt || 'Default').substring(0, 100) + '...', inline: false },
                    { name: '💭 Max History', value: `${config.maxHistory || 10} exchanges`, inline: true }
                )
                .setFooter({ text: 'Click buttons below to configure AI settings' })
                .setTimestamp();

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ai_toggle')
                        .setLabel(config.enabled ? 'Disable AI' : 'Enable AI')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('ai_set_prompt')
                        .setLabel('Set System Prompt')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('ai_set_temperature')
                        .setLabel('Set Temperature')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🌡️')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ai_set_history')
                        .setLabel('Set Max History')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💭'),
                    new ButtonBuilder()
                        .setCustomId('ai_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        } catch (error) {
            console.error('Error in aisetup execute:', error);
            await interaction.reply({ content: '❌ An error occurred while loading AI setup.', ephemeral: true });
        }
    },

    async handleButton(interaction) {
        try {
            const guildId = interaction.guild.id;
            const allSettings = loadSettings();
            const settings = getGuildSettings(guildId);
            const config = settings.ai;

            if (interaction.customId === 'ai_toggle') {
                config.enabled = !config.enabled;
                allSettings[guildId] = settings;
                saveSettings(allSettings);
                await this.updatePanel(interaction, settings);
                return;
            }

            if (interaction.customId === 'ai_set_prompt') {
                const modal = new ModalBuilder()
                    .setCustomId('ai_modal_prompt')
                    .setTitle('Set AI System Prompt');

                const promptInput = new TextInputBuilder()
                    .setCustomId('prompt')
                    .setLabel('System Prompt')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('You are a helpful PlayStation homebrew assistant.')
                    .setValue(config.systemPrompt || 'You are a helpful PlayStation homebrew assistant.')
                    .setRequired(true)
                    .setMaxLength(2000);

                const row = new ActionRowBuilder().addComponents(promptInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'ai_set_temperature') {
                const modal = new ModalBuilder()
                    .setCustomId('ai_modal_temperature')
                    .setTitle('Set AI Temperature');

                const tempInput = new TextInputBuilder()
                    .setCustomId('temperature')
                    .setLabel('Temperature (0.0 - 2.0)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('0.7')
                    .setValue(String(config.temperature || 0.7))
                    .setRequired(true)
                    .setMaxLength(4);

                const row = new ActionRowBuilder().addComponents(tempInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'ai_set_history') {
                const modal = new ModalBuilder()
                    .setCustomId('ai_modal_history')
                    .setTitle('Set Max History');

                const historyInput = new TextInputBuilder()
                    .setCustomId('history')
                    .setLabel('Max History (1-50)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('10')
                    .setValue(String(config.maxHistory || 10))
                    .setRequired(true)
                    .setMaxLength(2);

                const row = new ActionRowBuilder().addComponents(historyInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'ai_refresh') {
                await this.updatePanel(interaction, settings);
                return;
            }

        } catch (error) {
            console.error('Error in aisetup button handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async handleModal(interaction) {
        try {
            const guildId = interaction.guild.id;
            const allSettings = loadSettings();
            const settings = getGuildSettings(guildId);
            const config = settings.ai;

            if (interaction.customId === 'ai_modal_prompt') {
                const prompt = interaction.fields.getTextInputValue('prompt').trim();
                config.systemPrompt = prompt;
                allSettings[guildId] = settings;
                saveSettings(allSettings);
                await interaction.reply({ content: `✅ System prompt updated!`, ephemeral: true });
                return;
            }

            if (interaction.customId === 'ai_modal_temperature') {
                const tempStr = interaction.fields.getTextInputValue('temperature').trim();
                const temperature = parseFloat(tempStr);

                if (isNaN(temperature) || temperature < 0 || temperature > 2) {
                    return interaction.reply({ content: '❌ Invalid temperature! Must be between 0.0-2.0.', ephemeral: true });
                }

                config.temperature = temperature;
                allSettings[guildId] = settings;
                saveSettings(allSettings);
                await interaction.reply({ 
                    content: `✅ Temperature set to **${temperature}**! ${temperature < 0.3 ? '(Very focused)' : temperature < 0.7 ? '(Balanced)' : temperature < 1.0 ? '(Creative)' : '(Very creative)'}`, 
                    ephemeral: true 
                });
                return;
            }

            if (interaction.customId === 'ai_modal_history') {
                const historyStr = interaction.fields.getTextInputValue('history').trim();
                const history = parseInt(historyStr);

                if (isNaN(history) || history < 1 || history > 50) {
                    return interaction.reply({ content: '❌ Invalid number! Must be between 1-50.', ephemeral: true });
                }

                config.maxHistory = history;
                allSettings[guildId] = settings;
                saveSettings(allSettings);
                await interaction.reply({ content: `✅ Max history set to **${history} exchanges**!`, ephemeral: true });
                return;
            }

        } catch (error) {
            console.error('Error in aisetup modal handler:', error);
            await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
        }
    },

    async updatePanel(interaction, settings) {
        const config = settings.ai;

        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Chat Settings')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Configure AI chat responses and behavior.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '🤖 Model', value: config.model || 'gpt-4o-mini', inline: true },
                { name: '🌡️ Temperature', value: `${config.temperature || 0.7}`, inline: true },
                { name: '📝 System Prompt', value: (config.systemPrompt || 'Default').substring(0, 100) + '...', inline: false },
                { name: '💭 Max History', value: `${config.maxHistory || 10} exchanges`, inline: true }
            )
            .setFooter({ text: 'Click buttons below to configure AI settings' })
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ai_toggle')
                    .setLabel(config.enabled ? 'Disable AI' : 'Enable AI')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('ai_set_prompt')
                    .setLabel('Set System Prompt')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('ai_set_temperature')
                    .setLabel('Set Temperature')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🌡️')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ai_set_history')
                    .setLabel('Set Max History')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💭'),
                new ButtonBuilder()
                    .setCustomId('ai_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }
};
