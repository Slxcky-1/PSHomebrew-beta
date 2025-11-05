const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

// Mock PKG database (in real implementation, this would connect to NoPayStation API)
const pkgDatabase = {
    // PS4 Games (sample data)
    'CUSA00001': {
        title: 'Resogun',
        titleId: 'CUSA00001',
        console: 'PS4',
        region: 'US',
        version: '01.00',
        size: '850 MB',
        contentType: 'Game',
        genre: 'Action',
        developer: 'Housemarque',
        releaseDate: '2013-11-15',
        minFirmware: '1.00',
        maxFirmware: '11.00',
        dlcAvailable: true,
        updateAvailable: true,
        trusted: true,
        downloadUrl: 'https://nopaystation.com/pkg/CUSA00001',
        rapRequired: false
    },
    'CUSA07408': {
        title: 'Horizon Zero Dawn',
        titleId: 'CUSA07408',
        console: 'PS4',
        region: 'US',
        version: '01.54',
        size: '67.3 GB',
        contentType: 'Game',
        genre: 'Action RPG',
        developer: 'Guerrilla Games',
        releaseDate: '2017-02-28',
        minFirmware: '4.50',
        maxFirmware: '11.00',
        dlcAvailable: true,
        updateAvailable: true,
        trusted: true,
        downloadUrl: 'https://nopaystation.com/pkg/CUSA07408',
        rapRequired: false
    },
    
    // PS3 Games (sample data)
    'BLUS30463': {
        title: 'The Last of Us',
        titleId: 'BLUS30463',
        console: 'PS3',
        region: 'US',
        version: '01.11',
        size: '27 GB',
        contentType: 'Game',
        genre: 'Action Adventure',
        developer: 'Naughty Dog',
        releaseDate: '2013-06-14',
        minFirmware: '3.55',
        maxFirmware: '4.90',
        dlcAvailable: true,
        updateAvailable: true,
        trusted: true,
        downloadUrl: 'https://nopaystation.com/pkg/BLUS30463',
        rapRequired: true
    }
};

// Homebrew database
const homebrewDatabase = {
    ps4: [
        {
            name: 'GoldHEN',
            version: '2.4b18.6',
            developer: 'SiSTRo',
            category: 'system',
            description: 'PS4 homebrew enabler with game patching support',
            compatibility: ['9.00', '10.00', '10.01', '11.00', '12.00', '12.02'],
            downloadUrl: 'https://github.com/GoldHEN/GoldHEN',
            trusted: true,
            features: ['Game Patching', 'FTP Server', 'Debug Menu', 'PKG Installation']
        },
        {
            name: 'Apollo Save Tool',
            version: '1.8.3',
            developer: 'bucanero',
            category: 'system',
            description: 'PS4 save game manager with cheats and backup features',
            compatibility: ['9.00', '10.00', '10.01', '11.00', '12.00', '12.02'],
            downloadUrl: 'https://github.com/bucanero/apollo-ps4',
            trusted: true,
            features: ['Save Backup', 'Save Restore', 'Cheat Codes', 'Trophy Backup']
        },
        {
            name: 'RetroArch',
            version: '1.16.0',
            developer: 'libretro',
            category: 'emulators',
            description: 'Multi-system emulator frontend',
            compatibility: ['9.00', '10.00', '10.01', '11.00', '12.00', '12.02'],
            downloadUrl: 'https://github.com/libretro/RetroArch',
            trusted: true,
            features: ['Multi-Emulator', 'Netplay', 'Shaders', 'Save States']
        }
    ],
    ps5: [
        {
            name: 'etaHEN',
            version: '2.0b',
            developer: 'LightningMods',
            category: 'system',
            description: 'PS5 homebrew enabler',
            compatibility: ['7.61', '8.00', '8.50', '9.00', '10.00', '10.01'],
            downloadUrl: 'https://github.com/LightningMods/etaHEN',
            trusted: true,
            features: ['Homebrew Support', 'Debug Settings', 'FTP Server']
        },
        {
            name: 'ItemzFlow',
            version: '1.23',
            developer: 'LightningMods',
            category: 'system',
            description: 'PS5 PKG installer and manager',
            compatibility: ['7.61', '8.00', '8.50', '9.00', '10.00', '10.01'],
            downloadUrl: 'https://github.com/LightningMods/ItemzFlow',
            trusted: true,
            features: ['PKG Installation', 'Game Management', 'Update Management']
        }
    ],
    ps3: [
        {
            name: 'multiMAN',
            version: '04.85.01',
            developer: 'deank',
            category: 'files',
            description: 'PS3 backup manager and file explorer',
            compatibility: ['3.55', '4.90'],
            downloadUrl: 'http://store.brewology.com/multiman',
            trusted: true,
            features: ['Backup Manager', 'FTP Server', 'File Manager', 'Game Mounting']
        },
        {
            name: 'webMAN MOD',
            version: '1.47.45',
            developer: 'aldostools',
            category: 'system',
            description: 'PS3 web-based file manager and game launcher',
            compatibility: ['3.55', '4.90'],
            downloadUrl: 'https://github.com/aldostools/webMAN-MOD',
            trusted: true,
            features: ['Web Interface', 'Game Mounting', 'FTP Server', 'Temperature Monitor']
        }
    ]
};

// Search PKG database
function searchPKGDatabase(query, console = null, region = null) {
    const results = [];
    const searchTerm = query.toLowerCase();
    
    Object.values(pkgDatabase).forEach(pkg => {
        // Filter by console if specified
        if (console && pkg.console.toLowerCase() !== console.toLowerCase()) return;
        
        // Filter by region if specified
        if (region && pkg.region.toLowerCase() !== region.toLowerCase()) return;
        
        // Search in title, titleId, developer
        if (pkg.title.toLowerCase().includes(searchTerm) ||
            pkg.titleId.toLowerCase().includes(searchTerm) ||
            pkg.developer.toLowerCase().includes(searchTerm) ||
            pkg.genre.toLowerCase().includes(searchTerm)) {
            results.push(pkg);
        }
    });
    
    return results.slice(0, 10); // Limit to 10 results
}

// Get PKG by exact ID
function getPKGById(titleId) {
    return pkgDatabase[titleId.toUpperCase()] || null;
}

// Verify PKG file (mock function - real implementation would analyze uploaded files)
function verifyPKG(fileName, fileSize) {
    return {
        valid: true,
        titleId: 'CUSA00000',
        title: 'Sample Game',
        size: fileSize || '1.2 GB',
        integrity: 'GOOD',
        signed: true,
        region: 'US',
        console: 'PS4',
        warnings: []
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pkg')
        .setDescription('Search PKG database or analyze PKG files')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What to do')
                .setRequired(true)
                .addChoices(
                    { name: 'Search by game name', value: 'search' },
                    { name: 'Get PKG info by ID', value: 'info' },
                    { name: 'Verify PKG file', value: 'verify' },
                    { name: 'Browse by region', value: 'region' },
                    { name: 'Latest homebrew', value: 'homebrew' }
                ))
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query, PKG ID, or region code')
                .setRequired(false)),

    async execute(interaction) {
        const action = interaction.options.getString('action');
        const query = interaction.options.getString('query') || '';
        
        switch (action) {
            case 'search':
                await handleSearch(interaction, query);
                break;
            case 'info':
                await handlePKGInfo(interaction, query);
                break;
            case 'verify':
                await handleVerification(interaction);
                break;
            case 'region':
                await handleRegionBrowse(interaction, query);
                break;
            case 'homebrew':
                await handleHomebrew(interaction);
                break;
            default:
                await interaction.reply({ content: '❌ Unknown action!', ephemeral: true });
        }
    },
};

async function handleSearch(interaction, query) {
    if (!query.trim()) {
        return await interaction.reply({ 
            content: '❌ Please provide a search term! Example: `/pkg search Horizon Zero Dawn`', 
            ephemeral: true 
        });
    }
    
    const results = searchPKGDatabase(query);
    
    if (results.length === 0) {
        return await interaction.reply({ 
            content: `❌ No PKG files found for "${query}". Try a different search term or check spelling.`, 
            ephemeral: true 
        });
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`🔍 PKG Search Results: "${query}"`)
        .setDescription(`Found ${results.length} PKG file(s)`)
        .setColor(0x0066CC)
        .setTimestamp();
    
    // Add results
    results.forEach((pkg, index) => {
        const statusIcon = pkg.trusted ? '✅' : '⚠️';
        const rapIcon = pkg.rapRequired ? '🔑' : '🆓';
        
        embed.addFields({
            name: `${index + 1}. ${pkg.title}`,
            value: `**ID:** \`${pkg.titleId}\` ${statusIcon}\n**Console:** ${pkg.console} | **Region:** ${pkg.region}\n**Size:** ${pkg.size} | **Version:** ${pkg.version}\n**RAP:** ${rapIcon} ${pkg.rapRequired ? 'Required' : 'Not Required'}`,
            inline: true
        });
    });
    
    // Add usage instructions
    embed.addFields({
        name: '📖 Usage Instructions',
        value: '• Use `/pkg info <TITLE_ID>` for detailed information\n• ✅ = Verified safe source\n• 🔑 = Requires .rap license file\n• 🆓 = No license file needed',
        inline: false
    });
    
    // Create select menu for detailed info
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('pkg_detail_select')
        .setPlaceholder('Select a PKG for detailed information')
        .addOptions(
            results.slice(0, 10).map((pkg, index) => ({
                label: pkg.title.substring(0, 25),
                description: `${pkg.titleId} - ${pkg.console} ${pkg.region}`,
                value: pkg.titleId,
                emoji: pkg.trusted ? '✅' : '⚠️'
            }))
        );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

async function handlePKGInfo(interaction, titleId) {
    if (!titleId.trim()) {
        return await interaction.reply({ 
            content: '❌ Please provide a Title ID! Example: `/pkg info CUSA07408`', 
            ephemeral: true 
        });
    }
    
    const pkg = getPKGById(titleId);
    
    if (!pkg) {
        return await interaction.reply({ 
            content: `❌ PKG with Title ID "${titleId}" not found in database.`, 
            ephemeral: true 
        });
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`📦 ${pkg.title}`)
        .setDescription(pkg.genre ? `**Genre:** ${pkg.genre}` : '')
        .setColor(pkg.trusted ? 0x00FF00 : 0xFFAA00)
        .addFields(
            { name: '🎮 Console', value: pkg.console, inline: true },
            { name: '🌍 Region', value: pkg.region, inline: true },
            { name: '🆔 Title ID', value: `\`${pkg.titleId}\``, inline: true },
            { name: '📊 Size', value: pkg.size, inline: true },
            { name: '🔢 Version', value: pkg.version, inline: true },
            { name: '🔒 RAP Required', value: pkg.rapRequired ? '🔑 Yes' : '🆓 No', inline: true },
            { name: '👨‍💻 Developer', value: pkg.developer, inline: true },
            { name: '📅 Release Date', value: pkg.releaseDate, inline: true },
            { name: '⚙️ Firmware', value: `${pkg.minFirmware} - ${pkg.maxFirmware}`, inline: true }
        )
        .setTimestamp();
    
    // Add trust status
    if (pkg.trusted) {
        embed.addFields({ 
            name: '✅ Verified Source', 
            value: 'This PKG is from a trusted source and has been verified.', 
            inline: false 
        });
    } else {
        embed.addFields({ 
            name: '⚠️ Unverified Source', 
            value: 'This PKG source has not been verified. Download at your own risk.', 
            inline: false 
        });
    }
    
    // Add additional info
    const additionalInfo = [];
    if (pkg.dlcAvailable) additionalInfo.push('📦 DLC Available');
    if (pkg.updateAvailable) additionalInfo.push('🔄 Updates Available');
    
    if (additionalInfo.length > 0) {
        embed.addFields({ 
            name: '📋 Additional Info', 
            value: additionalInfo.join(' • '), 
            inline: false 
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Download Info')
                .setStyle(ButtonStyle.Link)
                .setURL(pkg.downloadUrl)
                .setEmoji('⬇️'),
            new ButtonBuilder()
                .setCustomId(`pkg_similar_${pkg.titleId}`)
                .setLabel('Similar Games')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔍'),
            new ButtonBuilder()
                .setCustomId(`pkg_report_${pkg.titleId}`)
                .setLabel('Report Issue')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️')
        );
    
    await interaction.reply({ embeds: [embed], components: [buttons] });
}

async function handleVerification(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('📁 PKG File Verification')
        .setDescription('Upload a PKG file to verify its integrity and get information about it.')
        .setColor(0x0066CC)
        .addFields(
            { name: '🔍 What we check', value: '• File integrity and signatures\n• Title ID and region\n• Firmware compatibility\n• Known issues or warnings', inline: false },
            { name: '📤 How to upload', value: '1. Drag and drop your PKG file\n2. Add the message "verify this PKG"\n3. Wait for analysis results', inline: false },
            { name: '⚠️ Privacy', value: 'Only file metadata is analyzed. Your file content remains private.', inline: false }
        )
        .setFooter({ text: 'Supported formats: .pkg files up to 100MB for analysis' })
        .setTimestamp();
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pkg_verify_help')
                .setLabel('Verification Help')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('❓'),
            new ButtonBuilder()
                .setCustomId('pkg_verify_examples')
                .setLabel('Example Results')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
        );
    
    await interaction.reply({ embeds: [embed], components: [buttons] });
}

async function handleRegionBrowse(interaction, region) {
    const regions = ['US', 'EU', 'JP', 'AS', 'KR'];
    
    if (!region || !regions.includes(region.toUpperCase())) {
        const embed = new EmbedBuilder()
            .setTitle('🌍 Browse PKGs by Region')
            .setDescription('Select a region to browse available PKG files')
            .setColor(0x0066CC)
            .addFields(
                { name: '🇺🇸 US (United States)', value: 'NTSC-U region games', inline: true },
                { name: '🇪🇺 EU (Europe)', value: 'PAL region games', inline: true },
                { name: '🇯🇵 JP (Japan)', value: 'NTSC-J region games', inline: true },
                { name: '🌏 AS (Asia)', value: 'Asian region games', inline: true },
                { name: '🇰🇷 KR (Korea)', value: 'Korean region games', inline: true },
                { name: '📖 Usage', value: 'Use `/pkg region US` to browse US games', inline: true }
            );
        
        return await interaction.reply({ embeds: [embed] });
    }
    
    // Filter PKGs by region
    const regionPKGs = Object.values(pkgDatabase).filter(pkg => 
        pkg.region.toLowerCase() === region.toLowerCase()
    );
    
    const embed = new EmbedBuilder()
        .setTitle(`🌍 ${region.toUpperCase()} Region PKGs`)
        .setDescription(`Found ${regionPKGs.length} PKG file(s) in ${region.toUpperCase()} region`)
        .setColor(0x0066CC);
    
    regionPKGs.slice(0, 10).forEach((pkg, index) => {
        embed.addFields({
            name: `${index + 1}. ${pkg.title}`,
            value: `**ID:** \`${pkg.titleId}\`\n**Console:** ${pkg.console} | **Size:** ${pkg.size}`,
            inline: true
        });
    });
    
    await interaction.reply({ embeds: [embed] });
}

async function handleHomebrew(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🛠️ PlayStation Homebrew Database')
        .setDescription('Browse homebrew applications for PlayStation consoles')
        .setColor(0x9B59B6)
        .addFields(
            { name: '🎮 PS4 Homebrew', value: `${homebrewDatabase.ps4.length} applications`, inline: true },
            { name: '🎮 PS5 Homebrew', value: `${homebrewDatabase.ps5.length} applications`, inline: true },
            { name: '🎮 PS3 Homebrew', value: `${homebrewDatabase.ps3.length} applications`, inline: true }
        );
    
    // Featured homebrew
    const featured = [
        homebrewDatabase.ps4[0], // GoldHEN
        homebrewDatabase.ps5[0], // etaHEN
        homebrewDatabase.ps3[0]  // multiMAN
    ];
    
    featured.forEach(app => {
        if (app) {
            embed.addFields({
                name: `⭐ ${app.name} v${app.version}`,
                value: `**Platform:** PS${app.category === 'system' ? '4/5' : '3/4'}\n**Developer:** ${app.developer}\n${app.description.substring(0, 100)}...`,
                inline: false
            });
        }
    });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('homebrew_console_select')
        .setPlaceholder('Select console to browse homebrew')
        .addOptions(
            { label: 'PlayStation 4', value: 'ps4', emoji: '🎮' },
            { label: 'PlayStation 5', value: 'ps5', emoji: '🎮' },
            { label: 'PlayStation 3', value: 'ps3', emoji: '🎮' }
        );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.reply({ embeds: [embed], components: [row] });
}

// Export helper functions
module.exports.searchPKGDatabase = searchPKGDatabase;
module.exports.getPKGById = getPKGById;
module.exports.homebrewDatabase = homebrewDatabase;