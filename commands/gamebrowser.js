const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gamebrowser')
        .setDescription('Browse PlayStation games with advanced filters')
        .addStringOption(option =>
            option.setName('console')
                .setDescription('Filter by console')
                .addChoices(
                    { name: 'All Consoles', value: 'all' },
                    { name: 'PS5', value: 'PS5' },
                    { name: 'PS4', value: 'PS4' },
                    { name: 'PS3', value: 'PS3' },
                    { name: 'PS Vita', value: 'PS Vita' },
                    { name: 'PSP', value: 'PSP' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('sort')
                .setDescription('Sort games by')
                .addChoices(
                    { name: 'Name (A-Z)', value: 'name_asc' },
                    { name: 'Name (Z-A)', value: 'name_desc' },
                    { name: 'File Size (Smallest)', value: 'size_asc' },
                    { name: 'File Size (Largest)', value: 'size_desc' },
                    { name: 'Release Date (Newest)', value: 'date_desc' },
                    { name: 'Release Date (Oldest)', value: 'date_asc' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('series')
                .setDescription('Show games from a specific series')
                .addChoices(
                    { name: 'God of War', value: 'God of War' },
                    { name: 'Uncharted', value: 'Uncharted' },
                    { name: 'The Last of Us', value: 'The Last of Us' },
                    { name: 'Spider-Man', value: 'Spider-Man' },
                    { name: 'Horizon', value: 'Horizon' },
                    { name: 'Bloodborne / Dark Souls', value: 'Bloodborne|Dark Souls' },
                    { name: 'Final Fantasy', value: 'Final Fantasy' },
                    { name: 'Persona', value: 'Persona' },
                    { name: 'Resident Evil', value: 'Resident Evil' },
                    { name: 'Call of Duty', value: 'Call of Duty' }
                )
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('dlc_only')
                .setDescription('Show only games with DLC available')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if database exists
            const dbPath = path.join(__dirname, '..', 'data', 'gameDatabase.json');
            if (!fs.existsSync(dbPath)) {
                return await interaction.editReply({
                    content: '⚠️ Game database not available. Please contact the server administrator.',
                    ephemeral: true
                });
            }

            const gameDatabase = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const consoleFilter = interaction.options.getString('console') || 'all';
            const sortOption = interaction.options.getString('sort') || 'name_asc';
            const seriesFilter = interaction.options.getString('series');
            const dlcOnly = interaction.options.getBoolean('dlc_only') || false;

            // Parse file size to bytes for sorting
            function parseSizeToBytes(sizeStr) {
                const match = sizeStr.match(/^([\d.]+)\s*(GB|MB|KB)/i);
                if (!match) return 0;
                const value = parseFloat(match[1]);
                const unit = match[2].toUpperCase();
                switch(unit) {
                    case 'GB': return value * 1024 * 1024 * 1024;
                    case 'MB': return value * 1024 * 1024;
                    case 'KB': return value * 1024;
                    default: return 0;
                }
            }

            // Filter games
            let games = Object.entries(gameDatabase.games).map(([id, game]) => ({ ...game, titleId: id }));

            if (consoleFilter !== 'all') {
                games = games.filter(g => g.console === consoleFilter);
            }

            if (seriesFilter) {
                const seriesKeywords = seriesFilter.split('|');
                games = games.filter(g => seriesKeywords.some(keyword => g.title.includes(keyword)));
            }

            if (dlcOnly) {
                games = games.filter(g => g.dlcAvailable === true);
            }

            // Sort games
            games.sort((a, b) => {
                switch(sortOption) {
                    case 'name_asc':
                        return a.title.localeCompare(b.title);
                    case 'name_desc':
                        return b.title.localeCompare(a.title);
                    case 'size_asc':
                        return parseSizeToBytes(a.fileSize) - parseSizeToBytes(b.fileSize);
                    case 'size_desc':
                        return parseSizeToBytes(b.fileSize) - parseSizeToBytes(a.fileSize);
                    case 'date_desc':
                        return new Date(b.releaseDate) - new Date(a.releaseDate);
                    case 'date_asc':
                        return new Date(a.releaseDate) - new Date(b.releaseDate);
                    default:
                        return 0;
                }
            });

            if (games.length === 0) {
                return await interaction.editReply({
                    content: '❌ No games found matching your filters.',
                    ephemeral: true
                });
            }

            // Paginate results (show 10 per page)
            const pageSize = 10;
            const totalPages = Math.ceil(games.length / pageSize);
            const page = 0; // Start at page 0
            const startIndex = page * pageSize;
            const endIndex = startIndex + pageSize;
            const pageGames = games.slice(startIndex, endIndex);

            // Build embed
            const filterInfo = [];
            if (consoleFilter !== 'all') filterInfo.push(`Console: **${consoleFilter}**`);
            if (seriesFilter) filterInfo.push(`Series: **${seriesFilter.replace('|', ' / ')}**`);
            if (dlcOnly) filterInfo.push(`DLC: **Available**`);
            
            const sortLabels = {
                'name_asc': 'Name (A-Z)',
                'name_desc': 'Name (Z-A)',
                'size_asc': 'Size (Smallest First)',
                'size_desc': 'Size (Largest First)',
                'date_desc': 'Release Date (Newest First)',
                'date_asc': 'Release Date (Oldest First)'
            };

            const embed = new EmbedBuilder()
                .setTitle('🎮 PlayStation Game Browser')
                .setColor(0x0070CC)
                .setDescription(
                    `**Filters:** ${filterInfo.length > 0 ? filterInfo.join(' • ') : 'None'}\n` +
                    `**Sort:** ${sortLabels[sortOption]}\n` +
                    `**Results:** ${games.length} games found\n\n` +
                    pageGames.map((g, i) => 
                        `**${startIndex + i + 1}.** ${g.title}\n` +
                        `└ ${g.console} • ${g.titleId} • ${g.fileSize}${g.dlcAvailable ? ' • 📦 DLC' : ''}`
                    ).join('\n\n')
                )
                .setFooter({ text: `Page ${page + 1} of ${totalPages} • Database v${gameDatabase._metadata.version} • ${gameDatabase._metadata.totalGames} total games` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in gamebrowser command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while browsing games.',
                ephemeral: true
            });
        }
    },
};
