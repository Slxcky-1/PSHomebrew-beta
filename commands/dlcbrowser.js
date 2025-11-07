const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dlcbrowser')
        .setDescription('Browse games with available DLC')
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
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const dbPath = path.join(__dirname, '..', 'data', 'gameDatabase.json');
            if (!fs.existsSync(dbPath)) {
                return await interaction.editReply({
                    content: '⚠️ Game database not available.',
                    ephemeral: true
                });
            }

            const gameDatabase = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const consoleFilter = interaction.options.getString('console') || 'all';

            // Find all games with DLC
            let gamesWithDLC = Object.entries(gameDatabase.games)
                .filter(([_, game]) => game.dlcAvailable === true)
                .map(([id, game]) => ({ ...game, titleId: id }));

            if (consoleFilter !== 'all') {
                gamesWithDLC = gamesWithDLC.filter(g => g.console === consoleFilter);
            }

            if (gamesWithDLC.length === 0) {
                return await interaction.editReply({
                    content: `❌ No games with DLC found${consoleFilter !== 'all' ? ` for ${consoleFilter}` : ''}.`,
                    ephemeral: true
                });
            }

            // Sort by console then name
            gamesWithDLC.sort((a, b) => {
                if (a.console !== b.console) {
                    const consoleOrder = { 'PS5': 1, 'PS4': 2, 'PS3': 3, 'PS Vita': 4, 'PSP': 5 };
                    return (consoleOrder[a.console] || 99) - (consoleOrder[b.console] || 99);
                }
                return a.title.localeCompare(b.title);
            });

            // Group by console for better display
            const gamesByConsole = {};
            gamesWithDLC.forEach(game => {
                if (!gamesByConsole[game.console]) {
                    gamesByConsole[game.console] = [];
                }
                gamesByConsole[game.console].push(game);
            });

            const embed = new EmbedBuilder()
                .setTitle('📦 Games with DLC Available')
                .setColor(0x9B59B6)
                .setDescription(
                    `Found **${gamesWithDLC.length}** games with downloadable content.\n` +
                    `${consoleFilter !== 'all' ? `**Console:** ${consoleFilter}\n` : ''}\n` +
                    `**Installation:**\n` +
                    `1️⃣ Install the base game PKG first\n` +
                    `2️⃣ Download DLC packages separately\n` +
                    `3️⃣ Install DLC PKGs via Package Installer\n` +
                    `4️⃣ DLC will appear in-game automatically\n`
                )
                .setFooter({ text: `Database v${gameDatabase._metadata.version} • ${gameDatabase._metadata.totalGames} total games` });

            // Add fields for each console
            for (const [console, games] of Object.entries(gamesByConsole)) {
                const consoleEmoji = {
                    'PS5': '🎮',
                    'PS4': '🎮',
                    'PS3': '🎮',
                    'PS Vita': '🎮',
                    'PSP': '🎮'
                };

                const gameList = games.slice(0, 10).map(g => 
                    `• **${g.title}**\n  └ ${g.titleId} • ${g.fileSize}`
                ).join('\n');

                embed.addFields({
                    name: `${consoleEmoji[console]} ${console} (${games.length} games)`,
                    value: gameList + (games.length > 10 ? `\n*...and ${games.length - 10} more*` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in dlcbrowser command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while browsing DLC.',
                ephemeral: true
            });
        }
    },
};
