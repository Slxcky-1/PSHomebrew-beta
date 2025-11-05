const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

// Firmware database
let firmwareData = {
    lastUpdate: Date.now(),
    ps3: {
        latest: '4.92',
        exploitable: '4.90',
        cfw: '4.92.2 Evilnat',
        status: '✅ Exploitable',
        riskLevel: 'LOW'
    },
    ps4: {
        latest: '13.02',
        exploitable: '12.02',
        goldhen: '12.02',
        bdjb: '12.02',
        status: '⚠️ Limited',
        riskLevel: 'MEDIUM'
    },
    ps5: {
        latest: '10.50',
        exploitable: '10.01',
        etahen: '10.01',
        lapse: '10.01',
        status: '⚠️ Limited',
        riskLevel: 'HIGH'
    },
    vita: {
        latest: '3.74',
        exploitable: '3.74',
        henkaku: '3.60-3.74',
        enso: '3.65',
        status: '✅ Fully Exploitable',
        riskLevel: 'VERY_LOW'
    },
    psp: {
        latest: '6.61',
        exploitable: '6.61',
        cfw: '6.61 PRO-C',
        status: '✅ Fully Exploitable',
        riskLevel: 'VERY_LOW'
    }
};

const firmwareFile = './data/firmwareData.json';

// Load firmware data
function loadFirmwareData() {
    try {
        if (fs.existsSync(firmwareFile)) {
            const data = JSON.parse(fs.readFileSync(firmwareFile, 'utf8'));
            firmwareData = { ...firmwareData, ...data };
        }
    } catch (error) {
        console.error('Error loading firmware data:', error);
    }
}

// Save firmware data
function saveFirmwareData() {
    try {
        fs.writeFileSync(firmwareFile, JSON.stringify(firmwareData, null, 2));
    } catch (error) {
        console.error('Error saving firmware data:', error);
    }
}

// Server notification settings
let notificationSettings = {};
const notifyFile = './data/firmwareNotifications.json';

function loadNotificationSettings() {
    try {
        if (fs.existsSync(notifyFile)) {
            notificationSettings = JSON.parse(fs.readFileSync(notifyFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading notification settings:', error);
        notificationSettings = {};
    }
}

function saveNotificationSettings() {
    try {
        fs.writeFileSync(notifyFile, JSON.stringify(notificationSettings, null, 2));
    } catch (error) {
        console.error('Error saving notification settings:', error);
    }
}

// Initialize data
loadFirmwareData();
loadNotificationSettings();

// Get risk color
function getRiskColor(level) {
    switch (level) {
        case 'VERY_LOW': return 0x00FF00; // Green
        case 'LOW': return 0x88FF00;      // Light Green
        case 'MEDIUM': return 0xFFAA00;   // Orange
        case 'HIGH': return 0xFF4400;     // Red-Orange
        case 'VERY_HIGH': return 0xFF0000; // Red
        default: return 0x888888;         // Gray
    }
}

// Get exploit recommendations
function getExploitRecommendations(console, currentFW) {
    const recommendations = {
        ps3: {
            message: currentFW <= '4.90' ? 
                '✅ **Perfect!** Stay on this firmware for maximum compatibility.' :
                '⚠️ **Consider downgrading** to 4.90 or below for better exploit support.',
            exploits: ['PS3HEN 3.4.0', 'Evilnat CFW', 'Rebug CFW'],
            tools: ['multiMAN', 'webMAN MOD', 'IRISMAN']
        },
        ps4: {
            message: currentFW <= '12.02' ? 
                '✅ **Excellent!** You can use GoldHEN and BD-JB exploits.' :
                '❌ **No exploits available** for this firmware. DO NOT UPDATE.',
            exploits: currentFW <= '12.02' ? ['GoldHEN 2.4b18.6', 'BD-JB by Gezine'] : ['None available'],
            tools: currentFW <= '12.02' ? ['PKG Installer', 'Homebrew Store', 'Save Data Manager'] : ['Wait for exploits']
        },
        ps5: {
            message: currentFW <= '10.01' ? 
                '✅ **Rare find!** You have a exploitable PS5. Guard it carefully!' :
                '❌ **No exploits available**. DO NOT UPDATE under any circumstances.',
            exploits: currentFW <= '10.01' ? ['etaHEN 2.0b', 'PS5 Lapse Exploit'] : ['None available'],
            tools: currentFW <= '10.01' ? ['ItemzFlow', 'Debug Tools', 'Save Manager'] : ['None available']
        },
        vita: {
            message: '✅ **All firmware versions exploitable!** Vita hacking is mature and stable.',
            exploits: ['HENkaku/Ensō', 'VitaShell', 'Molecular Shell'],
            tools: ['Adrenaline PSP Emulator', 'RetroArch', 'Homebrew Browser']
        },
        psp: {
            message: '✅ **All firmware versions exploitable!** PSP hacking is fully mature.',
            exploits: ['6.61 PRO-C', '6.61 ME', 'Infinity'],
            tools: ['PPSSPP Save Converter', 'RemoteJoy', 'CXMB Themes']
        }
    };
    
    return recommendations[console] || { message: 'Unknown console.', exploits: [], tools: [] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('firmware')
        .setDescription('Check latest firmware versions and exploit compatibility')
        .addStringOption(option =>
            option.setName('console')
                .setDescription('Console type')
                .setRequired(false)
                .addChoices(
                    { name: 'PS3', value: 'ps3' },
                    { name: 'PS4', value: 'ps4' },
                    { name: 'PS5', value: 'ps5' },
                    { name: 'PS Vita', value: 'vita' },
                    { name: 'PSP', value: 'psp' }
                )),

    async execute(interaction) {
        const console = interaction.options.getString('console');
        
        if (console) {
            // Show specific console info
            await showConsoleFirmware(interaction, console);
        } else {
            // Show all consoles overview
            await showAllFirmware(interaction);
        }
    },
};

async function showConsoleFirmware(interaction, console) {
    const data = firmwareData[console];
    if (!data) {
        return await interaction.reply({ content: '❌ Unknown console type!', ephemeral: true });
    }
    
    const consoleNames = {
        ps3: 'PlayStation 3',
        ps4: 'PlayStation 4', 
        ps5: 'PlayStation 5',
        vita: 'PlayStation Vita',
        psp: 'PlayStation Portable'
    };
    
    const embed = new EmbedBuilder()
        .setTitle(`📱 ${consoleNames[console]} Firmware Status`)
        .setColor(getRiskColor(data.riskLevel))
        .setTimestamp()
        .setFooter({ text: `Last updated: ${new Date(firmwareData.lastUpdate).toLocaleString()}` });
    
    // Add firmware info
    embed.addFields(
        { name: '🆕 Latest Official', value: data.latest, inline: true },
        { name: '🔓 Exploitable', value: data.exploitable, inline: true },
        { name: '📊 Status', value: data.status, inline: true }
    );
    
    // Add console-specific info
    if (console === 'ps3') {
        embed.addFields(
            { name: '⚙️ Latest CFW', value: data.cfw, inline: true },
            { name: '🛠️ Tools', value: 'PS3HEN, Evilnat, webMAN', inline: true }
        );
    } else if (console === 'ps4') {
        embed.addFields(
            { name: '🥇 GoldHEN Max', value: data.goldhen, inline: true },
            { name: '📀 BD-JB Max', value: data.bdjb, inline: true },
            { name: '⚠️ Warning', value: 'DO NOT update past 12.02!', inline: false }
        );
    } else if (console === 'ps5') {
        embed.addFields(
            { name: '🔥 etaHEN Max', value: data.etahen, inline: true },
            { name: '⚡ Lapse Max', value: data.lapse, inline: true },
            { name: '🚨 Critical', value: 'Exploitable PS5s are RARE!', inline: false }
        );
    }
    
    // Add recommendations
    const recommendations = getExploitRecommendations(console, data.latest);
    embed.addFields(
        { name: '💡 Recommendation', value: recommendations.message, inline: false },
        { name: '🔧 Available Exploits', value: recommendations.exploits.join(', '), inline: false },
        { name: '🛠️ Recommended Tools', value: recommendations.tools.join(', '), inline: false }
    );
    
    // Add action buttons
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`fw_refresh_${console}`)
                .setLabel('Refresh Data')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId(`fw_safe_${console}`)
                .setLabel('Safe Versions')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`fw_history_${console}`)
                .setLabel('FW History')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📜')
        );
    
    await interaction.reply({ embeds: [embed], components: [buttons] });
}

async function showAllFirmware(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('📱 PlayStation Firmware Status Overview')
        .setDescription('Current firmware status across all PlayStation consoles')
        .setColor(0x0066CC)
        .setTimestamp()
        .setFooter({ text: `Last updated: ${new Date(firmwareData.lastUpdate).toLocaleString()}` });
    
    // Add each console
    Object.entries(firmwareData).forEach(([console, data]) => {
        if (console === 'lastUpdate') return;
        
        const consoleEmojis = {
            ps3: '🎮',
            ps4: '🎮',
            ps5: '🎮',
            vita: '📱',
            psp: '🕹️'
        };
        
        const statusIcon = data.riskLevel === 'LOW' || data.riskLevel === 'VERY_LOW' ? '✅' : 
                          data.riskLevel === 'MEDIUM' ? '⚠️' : '❌';
        
        embed.addFields({
            name: `${consoleEmojis[console]} ${console.toUpperCase()}`,
            value: `**Latest:** ${data.latest}\n**Exploitable:** ${data.exploitable}\n**Status:** ${statusIcon} ${data.status}`,
            inline: true
        });
    });
    
    // Add global warnings
    embed.addFields({
        name: '🚨 Important Warnings',
        value: '• **PS4/PS5**: DO NOT update if you want homebrew\n• **Exploitable consoles are valuable** - guard them carefully\n• **Always backup** before attempting any exploits\n• **Check compatibility** before updating any homebrew',
        inline: false
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('fw_refresh_all')
                .setLabel('Refresh All Data')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('fw_notifications')
                .setLabel('Setup Notifications')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🔔'),
            new ButtonBuilder()
                .setCustomId('fw_safety_guide')
                .setLabel('Safety Guide')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📚')
        );
    
    await interaction.reply({ embeds: [embed], components: [buttons] });
}

// Export helper functions
module.exports.firmwareData = firmwareData;
module.exports.saveFirmwareData = saveFirmwareData;
module.exports.notificationSettings = notificationSettings;
module.exports.saveNotificationSettings = saveNotificationSettings;