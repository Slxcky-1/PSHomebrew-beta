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
            console.log('✅ Leveling Setup command executed by:', interaction.user.tag);
            if (!interaction.member.permissions.has('Administrator')) {
                console.log('❌ User lacks administrator permission');
                return interaction.reply({ content: '❌ You need Administrator permission to use this command.', ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const settings = loadSettings();
            console.log('📂 Loaded settings for guild:', guildId);
            
            if (!settings[guildId]) {
                settings[guildId] = {};
            }
            
            if (!settings[guildId].leveling) {
                settings[guildId].leveling = {
                    enabled: false,
                    xpMin: 15,
                    xpMax: 25,
                    cooldown: 60,
                    maxLevel: 100,
                    levelUpChannel: null,
                    levelUpMessagesEnabled: true,
                    roles: {}
                };
                saveSettings(settings);
            }

            const config = settings[guildId].leveling;
            console.log('⚙️ Current config:', JSON.stringify(config, null, 2));
        
            const levelRoles = Object.keys(config.roles || {}).length > 0 
                ? Object.entries(config.roles).map(([level, roleId]) => `• Level ${level}: <@&${roleId}>`).join('\n')
                : 'None';

            const embed = new EmbedBuilder()
                .setTitle('📊 Leveling System Settings')
                .setColor(0x5865F2)
                .addFields(
                    { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: 'Level Up Messages', value: config.levelUpMessagesEnabled ? '✅ On' : '❌ Off', inline: true },
                    { name: 'Level Up Channel', value: config.levelUpChannel ? `#${config.levelUpChannel}` : 'Current Channel', inline: true },
                    { name: 'XP Range', value: `${config.xpMin} - ${config.xpMax} per message`, inline: true },
                    { name: 'Cooldown', value: `${config.cooldown} seconds`, inline: true },
                    { name: 'Max Level', value: config.maxLevel.toString(), inline: true },
                    { name: 'Level Roles', value: levelRoles, inline: false }
                )
                .setFooter({ text: 'Use the buttons below to configure settings' });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lvl_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('lvl_toggle_messages')
                        .setLabel(config.levelUpMessagesEnabled ? 'Disable Messages' : 'Enable Messages')
                        .setStyle(config.levelUpMessagesEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId('lvl_set_xp')
                        .setLabel('Set XP Range')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⭐'),
                    new ButtonBuilder()
                        .setCustomId('lvl_set_cooldown')
                        .setLabel('Set Cooldown')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏱️'),
                    new ButtonBuilder()
                        .setCustomId('lvl_set_max')
                        .setLabel('Set Max Level')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎯')
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lvl_set_channel')
                        .setLabel('Set Level Up Channel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📢'),
                    new ButtonBuilder()
                        .setCustomId('lvl_add_role')
                        .setLabel('Add Level Role')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎭'),
                    new ButtonBuilder()
                        .setCustomId('lvl_remove_role')
                        .setLabel('Remove Level Role')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🗑️')
                        .setDisabled(Object.keys(config.roles || {}).length === 0)
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        } catch (error) {
            console.error('❌ Error in Leveling Setup execute:', error);
            console.error('Stack trace:', error.stack);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Failed to load leveling settings.', ephemeral: true });
            }
        }
    },

    async handleButton(interaction) {
        console.log('🔘 Leveling button clicked:', interaction.customId, 'by', interaction.user.tag);
        const guildId = interaction.guild.id;
        const settings = loadSettings();
        console.log('📂 Data loaded for button interaction');
        
        if (!settings[guildId] || !settings[guildId].leveling) {
            console.log('❌ No config found for guild:', guildId);
            return interaction.reply({ content: '❌ Leveling not configured. Use `/levelingsetup` first.', ephemeral: true });
        }

        const config = settings[guildId].leveling;
        console.log('⚙️ Config for button:', JSON.stringify(config, null, 2));

        // Toggle enabled/disabled
        if (interaction.customId === 'lvl_toggle') {
            try {
                console.log('🔄 Toggling leveling system...');
                config.enabled = !config.enabled;
                saveSettings(settings);
                console.log('✅ Leveling system now:', config.enabled ? 'ENABLED' : 'DISABLED');
            
                await this.updatePanel(interaction, settings, guildId);
            } catch (error) {
                console.error('❌ Error toggling leveling:', error);
                await interaction.reply({ content: '❌ Failed to toggle leveling.', ephemeral: true });
            }
        }

        // Toggle level up messages
        if (interaction.customId === 'lvl_toggle_messages') {
            try {
                config.levelUpMessagesEnabled = !config.levelUpMessagesEnabled;
                saveSettings(settings);
                await this.updatePanel(interaction, settings, guildId);
            } catch (error) {
                console.error('❌ Error toggling messages:', error);
                await interaction.reply({ content: '❌ Failed to toggle level up messages.', ephemeral: true });
            }
        }

        // Set XP Range
        if (interaction.customId === 'lvl_set_xp') {
            const modal = new ModalBuilder()
                .setCustomId('lvl_modal_xp')
                .setTitle('Set XP Range');

            const minInput = new TextInputBuilder()
                .setCustomId('xp_min')
                .setLabel('Minimum XP per message')
                .setStyle(TextInputStyle.Short)
                .setValue(config.xpMin.toString())
                .setRequired(true)
                .setPlaceholder('e.g., 15');

            const maxInput = new TextInputBuilder()
                .setCustomId('xp_max')
                .setLabel('Maximum XP per message')
                .setStyle(TextInputStyle.Short)
                .setValue(config.xpMax.toString())
                .setRequired(true)
                .setPlaceholder('e.g., 25');

            modal.addComponents(
                new ActionRowBuilder().addComponents(minInput),
                new ActionRowBuilder().addComponents(maxInput)
            );

            await interaction.showModal(modal);
        }

        // Set Cooldown
        if (interaction.customId === 'lvl_set_cooldown') {
            const modal = new ModalBuilder()
                .setCustomId('lvl_modal_cooldown')
                .setTitle('Set XP Cooldown');

            const cooldownInput = new TextInputBuilder()
                .setCustomId('cooldown')
                .setLabel('Cooldown in seconds')
                .setStyle(TextInputStyle.Short)
                .setValue(config.cooldown.toString())
                .setRequired(true)
                .setPlaceholder('e.g., 60');

            modal.addComponents(new ActionRowBuilder().addComponents(cooldownInput));
            await interaction.showModal(modal);
        }

        // Set Max Level
        if (interaction.customId === 'lvl_set_max') {
            const modal = new ModalBuilder()
                .setCustomId('lvl_modal_max')
                .setTitle('Set Maximum Level');

            const maxInput = new TextInputBuilder()
                .setCustomId('max_level')
                .setLabel('Maximum level (1-1000)')
                .setStyle(TextInputStyle.Short)
                .setValue(config.maxLevel.toString())
                .setRequired(true)
                .setPlaceholder('e.g., 100');

            modal.addComponents(new ActionRowBuilder().addComponents(maxInput));
            await interaction.showModal(modal);
        }

        // Set Level Up Channel
        if (interaction.customId === 'lvl_set_channel') {
            const channels = interaction.guild.channels.cache
                .filter(c => c.type === ChannelType.GuildText)
                .first(25);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('lvl_select_channel')
                .setPlaceholder('Select a channel for level up messages')
                .addOptions(
                    { label: 'Current Channel (Where User Chats)', value: 'none', description: 'Default behavior' },
                    ...channels.map(channel => ({
                        label: `#${channel.name}`,
                        value: channel.name,
                        description: `Send level ups to #${channel.name}`
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '📢 Select the channel for level up announcements:', components: [row], ephemeral: true });
        }

        // Add Level Role
        if (interaction.customId === 'lvl_add_role') {
            const modal = new ModalBuilder()
                .setCustomId('lvl_modal_add_role')
                .setTitle('Add Level Role');

            const levelInput = new TextInputBuilder()
                .setCustomId('role_level')
                .setLabel('Level number')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('e.g., 10');

            const roleInput = new TextInputBuilder()
                .setCustomId('role_id')
                .setLabel('Role ID or @mention')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Right-click role > Copy ID');

            modal.addComponents(
                new ActionRowBuilder().addComponents(levelInput),
                new ActionRowBuilder().addComponents(roleInput)
            );

            await interaction.showModal(modal);
        }

        // Remove Level Role
        if (interaction.customId === 'lvl_remove_role') {
            const roleOptions = Object.entries(config.roles || {}).slice(0, 25).map(([level, roleId]) => ({
                label: `Level ${level}`,
                value: level,
                description: `Remove role at level ${level}`
            }));

            if (roleOptions.length === 0) {
                return interaction.reply({ content: '❌ No level roles to remove!', ephemeral: true });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('lvl_select_remove_role')
                .setPlaceholder('Select a level role to remove')
                .addOptions(roleOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ content: '🗑️ Select the level role to remove:', components: [row], ephemeral: true });
        }
    },

    async handleModal(interaction) {
        console.log('📝 Leveling modal submitted:', interaction.customId);
        const guildId = interaction.guild.id;
        const settings = loadSettings();
        const config = settings[guildId].leveling;

        // Set XP Range
        if (interaction.customId === 'lvl_modal_xp') {
            const min = parseInt(interaction.fields.getTextInputValue('xp_min'));
            const max = parseInt(interaction.fields.getTextInputValue('xp_max'));

            if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
                return interaction.reply({ content: '❌ Invalid XP range! Min must be at least 1 and max must be greater than min.', ephemeral: true });
            }

            config.xpMin = min;
            config.xpMax = max;
            saveSettings(settings);
            
            await interaction.reply({ content: `✅ XP range set to **${min} - ${max}** per message!`, ephemeral: true });
        }

        // Set Cooldown
        if (interaction.customId === 'lvl_modal_cooldown') {
            const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown'));

            if (isNaN(cooldown) || cooldown < 0) {
                return interaction.reply({ content: '❌ Invalid cooldown! Must be 0 or greater.', ephemeral: true });
            }

            config.cooldown = cooldown;
            saveSettings(settings);
            
            await interaction.reply({ content: `✅ XP cooldown set to **${cooldown} seconds**!`, ephemeral: true });
        }

        // Set Max Level
        if (interaction.customId === 'lvl_modal_max') {
            const maxLevel = parseInt(interaction.fields.getTextInputValue('max_level'));

            if (isNaN(maxLevel) || maxLevel < 1 || maxLevel > 1000) {
                return interaction.reply({ content: '❌ Invalid max level! Must be between 1 and 1000.', ephemeral: true });
            }

            config.maxLevel = maxLevel;
            saveSettings(settings);
            
            await interaction.reply({ content: `✅ Maximum level set to **${maxLevel}**!`, ephemeral: true });
        }

        // Add Level Role
        if (interaction.customId === 'lvl_modal_add_role') {
            const level = parseInt(interaction.fields.getTextInputValue('role_level'));
            let roleId = interaction.fields.getTextInputValue('role_id').trim();

            // Extract role ID from mention format <@&123456789>
            const roleIdMatch = roleId.match(/<@&(\d+)>/);
            if (roleIdMatch) {
                roleId = roleIdMatch[1];
            }

            if (isNaN(level) || level < 1) {
                return interaction.reply({ content: '❌ Invalid level! Must be 1 or greater.', ephemeral: true });
            }

            // Verify role exists
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                return interaction.reply({ content: '❌ Invalid role! Make sure the role ID is correct and the role exists.', ephemeral: true });
            }

            if (!config.roles) config.roles = {};
            config.roles[level] = roleId;
            saveSettings(settings);
            
            await interaction.reply({ content: `✅ Level role added! Users will receive ${role} at level **${level}**.`, ephemeral: true });
        }
    },

    async handleSelectMenu(interaction) {
        console.log('📋 Leveling select menu:', interaction.customId, 'value:', interaction.values[0]);
        const guildId = interaction.guild.id;
        const settings = loadSettings();
        const config = settings[guildId].leveling;

        // Set Channel
        if (interaction.customId === 'lvl_select_channel') {
            const channelName = interaction.values[0];
            
            if (channelName === 'none') {
                config.levelUpChannel = null;
                saveSettings(settings);
                await interaction.update({ content: '✅ Level up messages will now appear in the **current channel** where users chat!', components: [] });
            } else {
                config.levelUpChannel = channelName;
                saveSettings(settings);
                await interaction.update({ content: `✅ Level up messages will now be sent to **#${channelName}**!`, components: [] });
            }
        }

        // Remove Role
        if (interaction.customId === 'lvl_select_remove_role') {
            const level = interaction.values[0];
            
            if (config.roles && config.roles[level]) {
                delete config.roles[level];
                saveSettings(settings);
                await interaction.update({ content: `✅ Level role removed for level **${level}**!`, components: [] });
            } else {
                await interaction.update({ content: '❌ Level role not found!', components: [] });
            }
        }
    },

    async updatePanel(interaction, settings, guildId) {
        const config = settings[guildId].leveling;
        
        const levelRoles = Object.keys(config.roles || {}).length > 0 
            ? Object.entries(config.roles).map(([level, roleId]) => `• Level ${level}: <@&${roleId}>`).join('\n')
            : 'None';

        const embed = new EmbedBuilder()
            .setTitle('📊 Leveling System Settings')
            .setColor(0x5865F2)
            .addFields(
                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Level Up Messages', value: config.levelUpMessagesEnabled ? '✅ On' : '❌ Off', inline: true },
                { name: 'Level Up Channel', value: config.levelUpChannel ? `#${config.levelUpChannel}` : 'Current Channel', inline: true },
                { name: 'XP Range', value: `${config.xpMin} - ${config.xpMax} per message`, inline: true },
                { name: 'Cooldown', value: `${config.cooldown} seconds`, inline: true },
                { name: 'Max Level', value: config.maxLevel.toString(), inline: true },
                { name: 'Level Roles', value: levelRoles, inline: false }
            )
            .setFooter({ text: 'Use the buttons below to configure settings' });

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lvl_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('lvl_toggle_messages')
                    .setLabel(config.levelUpMessagesEnabled ? 'Disable Messages' : 'Enable Messages')
                    .setStyle(config.levelUpMessagesEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('lvl_set_xp')
                    .setLabel('Set XP Range')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⭐'),
                new ButtonBuilder()
                    .setCustomId('lvl_set_cooldown')
                    .setLabel('Set Cooldown')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('lvl_set_max')
                    .setLabel('Set Max Level')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎯')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lvl_set_channel')
                    .setLabel('Set Level Up Channel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('lvl_add_role')
                    .setLabel('Add Level Role')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎭'),
                new ButtonBuilder()
                    .setCustomId('lvl_remove_role')
                    .setLabel('Remove Level Role')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️')
                    .setDisabled(Object.keys(config.roles || {}).length === 0)
            );

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }
};
