const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Change bot language for this server')
        .addStringOption(option =>
            option.setName('lang')
                .setDescription('Select language')
                .setRequired(true)
                .addChoices(
                    { name: '🇬🇧 English', value: 'en' },
                    { name: '🇪🇸 Español', value: 'es' },
                    { name: '🇫🇷 Français', value: 'fr' },
                    { name: '🇩🇪 Deutsch', value: 'de' },
                    { name: '🇵🇹 Português', value: 'pt' },
                    { name: '🇯🇵 日本語', value: 'ja' }
                )),
    
    async execute(interaction) {
        // Check admin permissions
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ You need Administrator permissions to change the bot language!',
                ephemeral: true
            });
        }

        const selectedLang = interaction.options.getString('lang');
        const guildId = interaction.guild.id;

        // Load server settings
        const fs = require('fs');
        const settingsFile = './serverSettings.json';
        let serverSettings = {};
        
        try {
            if (fs.existsSync(settingsFile)) {
                serverSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading server settings:', error);
        }

        // Update language
        if (!serverSettings[guildId]) {
            serverSettings[guildId] = {};
        }
        serverSettings[guildId].language = selectedLang;

        // Save settings
        try {
            fs.writeFileSync(settingsFile, JSON.stringify(serverSettings, null, 4));
        } catch (error) {
            console.error('Error saving server settings:', error);
            return interaction.reply({
                content: '❌ Failed to save language settings!',
                ephemeral: true
            });
        }

        // Get language name and flag
        const languages = {
            'en': { name: 'English', flag: '🇬🇧' },
            'es': { name: 'Español', flag: '🇪🇸' },
            'fr': { name: 'Français', flag: '🇫🇷' },
            'de': { name: 'Deutsch', flag: '🇩🇪' },
            'pt': { name: 'Português', flag: '🇵🇹' },
            'ja': { name: '日本語', flag: '🇯🇵' }
        };

        const langInfo = languages[selectedLang];
        
        return interaction.reply({
            content: `✅ Language changed to ${langInfo.flag} **${langInfo.name}**!`,
            ephemeral: false
        });
    },
};
