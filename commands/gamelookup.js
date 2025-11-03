const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// PlayStation game database (sample data - can be expanded)
const GAME_DATABASE = {
    'NPUB30298': { title: 'The Last of Us', region: 'USA', console: 'PS3', cfw: 'Yes', pkg: 'Available' },
    'NPUA80662': { title: 'Gran Turismo 5', region: 'USA', console: 'PS3', cfw: 'Yes', pkg: 'Available' },
    'NPUB31319': { title: 'Uncharted 3', region: 'USA', console: 'PS3', cfw: 'Yes', pkg: 'Available' },
    'CUSA00288': { title: 'Infamous Second Son', region: 'USA', console: 'PS4', cfw: 'Yes (≤11.00)', pkg: 'Available' },
    'CUSA00552': { title: 'The Last of Us Remastered', region: 'USA', console: 'PS4', cfw: 'Yes (≤11.00)', pkg: 'Available' },
    'CUSA02299': { title: 'Uncharted 4', region: 'USA', console: 'PS4', cfw: 'Yes (≤11.00)', pkg: 'Available' },
    'CUSA19722': { title: 'The Last of Us Part II', region: 'USA', console: 'PS4', cfw: 'Yes (≤11.00)', pkg: 'Available' },
    'CUSA07022': { title: 'God of War', region: 'USA', console: 'PS4', cfw: 'Yes (≤11.00)', pkg: 'Available' },
    'PPSA01284': { title: 'Spider-Man: Miles Morales', region: 'USA', console: 'PS5', cfw: 'Yes (≤4.51)', pkg: 'Available' },
    'PPSA01433': { title: 'Demon\'s Souls', region: 'USA', console: 'PS5', cfw: 'Yes (≤4.51)', pkg: 'Available' },
    'ULUS10041': { title: 'Grand Theft Auto: Liberty City Stories', region: 'USA', console: 'PSP', cfw: 'Yes', pkg: 'ISO Available' },
    'ULUS10160': { title: 'God of War: Chains of Olympus', region: 'USA', console: 'PSP', cfw: 'Yes', pkg: 'ISO Available' },
    'PCSE00120': { title: 'Persona 4 Golden', region: 'USA', console: 'PS Vita', cfw: 'Yes', pkg: 'Available' },
    'PCSE00491': { title: 'Killzone Mercenary', region: 'USA', console: 'PS Vita', cfw: 'Yes', pkg: 'Available' }
};

// Game title to ID mapping for search
const TITLE_TO_ID = {};
Object.keys(GAME_DATABASE).forEach(id => {
    const title = GAME_DATABASE[id].title.toLowerCase();
    TITLE_TO_ID[title] = id;
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamelookup')
        .setDescription('Look up PlayStation game information and CFW compatibility')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Game title or ID (e.g., "The Last of Us" or "NPUB30298")')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query').trim();
        
        // Check if query is a game ID
        let gameId = query.toUpperCase();
        let gameData = GAME_DATABASE[gameId];

        // If not found by ID, search by title
        if (!gameData) {
            const lowerQuery = query.toLowerCase();
            const matchingTitle = Object.keys(TITLE_TO_ID).find(title => 
                title.includes(lowerQuery) || lowerQuery.includes(title)
            );

            if (matchingTitle) {
                gameId = TITLE_TO_ID[matchingTitle];
                gameData = GAME_DATABASE[gameId];
            }
        }

        if (!gameData) {
            // No exact match - show similar results
            const similarGames = Object.keys(GAME_DATABASE)
                .filter(id => {
                    const title = GAME_DATABASE[id].title.toLowerCase();
                    return title.includes(query.toLowerCase()) || query.toLowerCase().includes(title);
                })
                .slice(0, 5);

            if (similarGames.length > 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🔍 No Exact Match - Similar Games:')
                    .setDescription(similarGames.map(id => 
                        `**${GAME_DATABASE[id].title}**\nID: \`${id}\` | Console: ${GAME_DATABASE[id].console}`
                    ).join('\n\n'))
                    .setColor(0xFFAA00)
                    .setFooter({ text: 'Try searching again with the exact ID or title' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ 
                    content: '❌ Game not found in database. Try another search term or game ID.', 
                    ephemeral: true 
                });
            }
            return;
        }

        // Display game information
        const consoleEmojis = {
            'PS3': '🎮',
            'PS4': '🎯',
            'PS5': '⚡',
            'PSP': '📱',
            'PS Vita': '🎨'
        };

        const embed = new EmbedBuilder()
            .setTitle(`${consoleEmojis[gameData.console]} ${gameData.title}`)
            .setColor(0x003087)
            .addFields(
                { name: '🆔 Game ID', value: `\`${gameId}\``, inline: true },
                { name: '🌍 Region', value: gameData.region, inline: true },
                { name: '🎮 Console', value: gameData.console, inline: true },
                { name: '⚙️ CFW Compatible', value: gameData.cfw, inline: true },
                { name: '📦 PKG Status', value: gameData.pkg, inline: true }
            )
            .setFooter({ text: 'Database maintained by PSHomebrew community' })
            .setTimestamp();

        // Add CFW instructions based on console
        if (gameData.console === 'PS4') {
            embed.addFields({
                name: '📝 Installation Notes',
                value: '• Requires PS4 firmware ≤11.00\n• Install PKG via Package Installer\n• Use GoldHEN for backup loading'
            });
        } else if (gameData.console === 'PS5') {
            embed.addFields({
                name: '📝 Installation Notes',
                value: '• Requires PS5 firmware ≤4.51\n• Use PS5 IPV6 kernel exploit\n• Install via Package Installer'
            });
        } else if (gameData.console === 'PS3') {
            embed.addFields({
                name: '📝 Installation Notes',
                value: '• Install via multiMAN or IRISMAN\n• Place PKG in /dev_hdd0/packages/\n• Install from Package Manager'
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};
