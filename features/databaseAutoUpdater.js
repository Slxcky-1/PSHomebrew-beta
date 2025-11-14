// Auto-update scraper for PlayStation game database
// Runs daily to check for new games and firmware updates

const fs = require('fs');
const path = require('path');
const { search } = require('duck-duck-scrape');

class DatabaseAutoUpdater {
    constructor(bot) {
        this.bot = bot;
        this.dbPath = path.join(__dirname, '..', 'data', 'gameDatabase.json');
        this.lastCheckPath = path.join(__dirname, '..', 'data', 'lastDatabaseUpdate.json');
        this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    }

    async start() {
        console.log('📡 Starting database auto-updater...');
        
        // Schedule to run at 9 PM (21:00) every day
        this.scheduleDaily9PM();
    }

    scheduleDaily9PM() {
        const now = new Date();
        const target = new Date();
        target.setHours(21, 0, 0, 0); // 9 PM
        
        // If 9 PM has already passed today, schedule for tomorrow
        if (now > target) {
            target.setDate(target.getDate() + 1);
        }
        
        const timeUntilRun = target.getTime() - now.getTime();
        
        console.log(`⏰ Next database check scheduled for: ${target.toLocaleString()}`);
        
        // Schedule first run
        setTimeout(async () => {
            await this.checkForUpdates();
            
            // Then run every 24 hours at 9 PM
            setInterval(async () => {
                await this.checkForUpdates();
            }, 24 * 60 * 60 * 1000);
        }, timeUntilRun);
    }

    async checkForUpdates() {
        try {
            console.log('🔍 Checking for database updates...');
            
            const updates = {
                newGames: [],
                firmwareUpdates: [],
                timestamp: new Date().toISOString()
            };

            // Check for new PlayStation Store releases
            await this.checkNewReleases(updates);
            
            // Check for firmware updates
            await this.checkFirmwareUpdates(updates);
            
            // Save check timestamp
            fs.writeFileSync(this.lastCheckPath, JSON.stringify({
                lastCheck: updates.timestamp,
                newGamesFound: updates.newGames.length,
                firmwareUpdates: updates.firmwareUpdates.length
            }, null, 2));

            // Notify if updates found
            if (updates.newGames.length > 0 || updates.firmwareUpdates.length > 0) {
                await this.notifyAdmins(updates);
            }

            console.log(`✅ Database check complete. New games: ${updates.newGames.length}, Firmware updates: ${updates.firmwareUpdates.length}`);
            
        } catch (error) {
            console.error('❌ Error checking for database updates:', error);
        }
    }

    async checkNewReleases(updates) {
        try {
            // Search for recent PlayStation releases
            const searches = [
                'new PS5 games 2025',
                'new PS4 games 2025',
                'latest PlayStation releases'
            ];

            for (const query of searches) {
                const results = await search(query, {
                    safeSearch: 0
                });

                // Parse results for game titles and IDs
                // This is a simplified version - production would use proper API
                const gamePattern = /(CUSA|PPSA|NPUB|NPJB|NPEB|NPUA|PCSA|PCSB|PCSF|PCSM|ULUS|UCUS|ULES)\d{5}/gi;
                
                results.results.slice(0, 5).forEach(result => {
                    const matches = result.description.match(gamePattern);
                    if (matches) {
                        matches.forEach(titleId => {
                            // Check if already in database
                            const db = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                            if (!db.games[titleId]) {
                                updates.newGames.push({
                                    titleId,
                                    potentialTitle: result.title,
                                    source: result.url
                                });
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error checking new releases:', error);
        }
    }

    async checkFirmwareUpdates(updates) {
        try {
            // Check PS5 firmware
            const ps5Results = await search('PS5 firmware latest version', { safeSearch: 0 });
            const ps5FW = this.extractFirmwareVersion(ps5Results.results);
            
            // Check PS4 firmware
            const ps4Results = await search('PS4 firmware latest version', { safeSearch: 0 });
            const ps4FW = this.extractFirmwareVersion(ps4Results.results);
            
            // Check PS3 firmware
            const ps3Results = await search('PS3 firmware latest version CFW', { safeSearch: 0 });
            const ps3FW = this.extractFirmwareVersion(ps3Results.results);

            // Check for exploit updates
            const exploitResults = await search('PlayStation jailbreak exploit 2025', { safeSearch: 0 });
            
            if (exploitResults.results.length > 0) {
                const recentExploits = exploitResults.results.slice(0, 3).map(r => ({
                    title: r.title,
                    url: r.url,
                    date: new Date().toISOString()
                }));
                
                updates.firmwareUpdates.push(...recentExploits);
            }

        } catch (error) {
            console.error('Error checking firmware updates:', error);
        }
    }

    extractFirmwareVersion(results) {
        // Extract firmware version from search results
        const versionPattern = /\b\d+\.\d+(\.\d+)?\b/g;
        
        for (const result of results.slice(0, 3)) {
            const text = result.title + ' ' + result.description;
            const matches = text.match(versionPattern);
            if (matches) {
                return matches[0];
            }
        }
        return null;
    }

    async notifyAdmins(updates) {
        try {
            // Get server settings to find admin channels
            const serverSettingsPath = path.join(__dirname, '..', 'data', 'serverSettings.json');
            if (!fs.existsSync(serverSettingsPath)) return;

            const serverSettings = JSON.parse(fs.readFileSync(serverSettingsPath, 'utf8'));

            for (const [guildId, settings] of Object.entries(serverSettings)) {
                try {
                    const guild = this.bot.guilds.cache.get(guildId);
                    if (!guild) continue;

                    // Send to specific database update channel
                    const notifyChannel = guild.channels.cache.get('920750934085222470');
                    
                    if (notifyChannel) {
                        let message = '🔔 **Database Update Alert**\n\n';
                        
                        if (updates.newGames.length > 0) {
                            message += `📦 **${updates.newGames.length} New Games Detected:**\n`;
                            updates.newGames.slice(0, 5).forEach(game => {
                                message += `• ${game.titleId} - ${game.potentialTitle}\n`;
                            });
                            if (updates.newGames.length > 5) {
                                message += `*...and ${updates.newGames.length - 5} more*\n`;
                            }
                            message += '\n';
                        }

                        if (updates.firmwareUpdates.length > 0) {
                            message += `🔧 **${updates.firmwareUpdates.length} Firmware/Exploit Updates:**\n`;
                            updates.firmwareUpdates.slice(0, 3).forEach(update => {
                                message += `• ${update.title}\n`;
                            });
                            message += '\n';
                        }

                        message += `*Last checked: ${new Date().toLocaleString()}*`;

                        await notifyChannel.send(message);
                    }
                } catch (error) {
                    console.error(`Error notifying guild ${guildId}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in notifyAdmins:', error);
        }
    }
}

module.exports = DatabaseAutoUpdater;
