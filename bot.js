// --- Global error handling ---
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// --- End global error handling ---
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, PermissionFlagsBits, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fsSync = require('fs');
const fs = require('fs').promises;
const ps3ErrorCodes = require('./features/ps3ErrorCodes.json');
const { Snake, TicTacToe, Connect4, Wordle, Minesweeper, TwoZeroFourEight, MatchPairs, FastType, FindEmoji, GuessThePokemon, RockPaperScissors, Hangman, Trivia, Slots, WouldYouRather } = require('discord-gamecord');
const { search } = require('duck-duck-scrape');
const Parser = require('rss-parser');
const rssParser = new Parser();

// Load configuration
let config;
try {
    config = require('./config.json');
    console.log('✅ Loaded configuration from config.json');
} catch (error) {
    console.error('❌ ERROR: config.json not found!');
    console.error('Please create config.json with your bot token and client ID');
    process.exit(1);
}

// Validate required configuration
if (!config.token || !config.clientId) {
    console.error('❌ ERROR: Missing required configuration!');
    console.error('config.json must contain "token" and "clientId"');
    process.exit(1);
}

// Validate PS3 error codes loaded
if (!ps3ErrorCodes || Object.keys(ps3ErrorCodes).length === 0) {
    console.warn('⚠️ WARNING: No PS3 error codes loaded. Error detection will not work.');
}

// Initialize Discord client with optimized settings for low-end PCs
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    // Performance optimizations
    makeCache: require('discord.js').Options.cacheWithLimits({
        MessageManager: 50, // Limit message cache to 50 messages
        GuildMemberManager: 100, // Limit member cache to 100 members
        UserManager: 100, // Limit user cache to 100 users
        ReactionManager: 0, // Don't cache reactions
        PresenceManager: 0, // Don't cache presences
        VoiceStateManager: 0 // Don't cache voice states
    }),
    sweepers: {
        // Auto-sweep caches every 30 minutes
        messages: {
            interval: 1800, // 30 minutes in seconds
            lifetime: 900 // Keep messages for 15 minutes
        },
        users: {
            interval: 1800,
            filter: () => user => user.bot && user.id !== client.user.id
        }
    },
    // Reduce sharding overhead
    shards: 'auto',
    shardCount: 1
});

// Load or create user data file for leveling system
let userData = {};
const userDataFile = './userData.json';

// Load or create server settings
let serverSettings = {};
const settingsFile = './serverSettings.json';

// Ticket system data
let ticketData = {};
const ticketDataFile = './ticketData.json';

// Moderation data
let moderationData = {};
const moderationDataFile = './moderationData.json';

// AI conversation history (stored in memory only, not persisted)
let aiConversations = {}; // { channelId: [ { role: 'user'|'assistant', content: 'message', userId?: string } ] }
let aiCooldowns = {}; // { userId: timestamp} - Track cooldowns per user
let aiUserProfiles = {}; // { userId: { messageCount: number, lastTone: 'question'|'joke'|'casual', recentMessages: [] } }
let aiLockdown = {}; // { guildId: { locked: boolean, lockedBy: userId, reason: string, timestamp: number } }

// Jailbreak detection patterns
// Import DeepSeek SDK
const { createDeepSeek } = require('@ai-sdk/deepseek');
const { generateText } = require('ai');

// Optimized jailbreak detection - simplified patterns
const jailbreakPatterns = [
    /\b(DAN|jailbreak mode|developer mode|god mode)\b/i,
    /\b(ignore|forget|disregard)\s+(previous|all|your)\s+(instructions?|rules?)\b/i,
    /\b(pretend|act as|roleplay as)\b.*\b(unrestricted|unfiltered|without\s+limits?)\b/i,
    /\b(override|bypass|disable)\b.*\b(safety|filter|restriction)\b/i,
    /\[SYSTEM\]|\[INST\]|<\|im_start\|>|\{system\}/i,
    /\b(switch to|activate|enable)\b.*\b(mode|character)\b.*\b(unrestricted|uncensored)\b/i
];

// Detect jailbreak attempts - optimized
function detectJailbreak(message) {
    // Quick pattern check
    for (const pattern of jailbreakPatterns) {
        if (pattern.test(message)) return true;
    }
    
    // Heuristic check only for long messages
    if (message.length > 500) {
        const instructCount = (message.match(/\b(you (are|must)|from now|always|never)\b/gi) || []).length;
        const sysWords = (message.match(/\b(system|prompt|override|bypass)\b/gi) || []).length;
        if (instructCount > 5 && sysWords > 3) return true;
    }
    
    return false;
}

// DuckDuckGo search function with NSFW filtering
async function searchWeb(query) {
    try {
        const searchResults = await search(query, {
            safeSearch: -1, // Moderate NSFW filtering (-2=off, -1=moderate, 0=strict)
            locale: 'en-us'
        });
        
        if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
            return null;
        }
        
        // Get top 3 results
        const topResults = searchResults.results.slice(0, 3).map(result => ({
            title: result.title,
            description: result.description,
            url: result.url
        }));
        
        return topResults;
    } catch (error) {
        console.error('DuckDuckGo search error:', error);
        return null;
    }
}

// Lock AI for a guild
function lockAI(guildId, userId, username, reason) {
    aiLockdown[guildId] = {
        locked: true,
        lockedBy: userId,
        lockedByUsername: username,
        reason: reason,
        timestamp: Date.now()
    };
    console.log(`🔒 AI locked in guild ${guildId} by ${username} (${userId}). Reason: ${reason}`);
}

// Unlock AI for a guild
function unlockAI(guildId) {
    if (aiLockdown[guildId]) {
        delete aiLockdown[guildId];
        console.log(`🔓 AI unlocked in guild ${guildId}`);
        return true;
    }
    return false;
}

// Check if AI is locked
function isAILocked(guildId) {
    return aiLockdown[guildId] && aiLockdown[guildId].locked;
}

// Analyze user's conversation tone - optimized
function analyzeUserTone(message, userId) {
    // Initialize user profile
    if (!aiUserProfiles[userId]) {
        aiUserProfiles[userId] = { messageCount: 0, lastTone: 'casual', recentMessages: [] };
    }
    
    const profile = aiUserProfiles[userId];
    profile.messageCount++;
    profile.recentMessages.push(message.toLowerCase());
    if (profile.recentMessages.length > 5) profile.recentMessages.shift();
    
    const lower = message.toLowerCase();
    
    // Simplified tone detection
    const isQuestion = /\b(how|what|why|help|explain|error|fix|problem)\b/i.test(lower) || message.includes('?');
    const isBanter = /\b(lol|lmao|haha|funny|joke|bro|mate)\b/i.test(lower) || /[😀😁😂🤣😅😆😊😎]/u.test(message);
    const isTechnical = /\b(code|script|error code|debug|install|setup|api|command)\b/i.test(lower);
    
    // Determine tone
    profile.lastTone = (isQuestion && isTechnical) ? 'technical' : isQuestion ? 'question' : isBanter ? 'joke' : 'casual';
    
    return profile.lastTone;
}

// Generate personality instruction based on user tone
function getPersonalityForTone(tone, username) {
    switch (tone) {
        case 'question':
            return `The user ${username} is asking a genuine question and needs help. CRITICAL: Give a complete, direct answer to their question. No puns, no wordplay, no jokes. They want information, not entertainment. Answer thoroughly and clearly. Focus entirely on helping them understand. Be straightforward and informative.`;
        
        case 'technical':
            return `The user ${username} is asking a technical question. CRITICAL: Provide a precise, complete technical answer. Absolutely NO puns, jokes, or humor. Give them exact technical information with clear step-by-step guidance if needed. Be professional and thorough. Answer the question fully.`;
        
        case 'joke':
            return `The user ${username} is in a playful, joking mood. Match their energy! Be cheeky, sarcastic, and fun. This is the time to really lean into the British banter and dry humour. Take the piss, be witty, and keep it light-hearted. They're here for fun, not serious help.`;
        
        case 'casual':
        default:
            return `The user ${username} is having a casual chat. Be friendly and relaxed. Mix in some light sarcasm when appropriate, but keep it balanced. Casual conversation with a mate vibe.`;
    }
}

// Helper function to load JSON files safely - reduces code duplication
function loadJSON(filePath, defaultValue = {}) {
    try {
        if (fsSync.existsSync(filePath)) {
            return JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`⚠️ Error loading ${filePath}:`, error.message);
    }
    return defaultValue;
}

// Helper function to save JSON files safely
function saveJSON(filePath, data) {
    try {
        fsSync.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`⚠️ Error saving ${filePath}:`, error.message);
        return false;
    }
}

// Default settings template
const defaultSettings = {
    leveling: {
        enabled: true,
        minXP: 15,
        maxXP: 25,
        cooldown: 60000,
        maxLevel: 100,
        showLevelUpMessages: true,
        levelUpChannel: null, // null means use current channel
        levelRoles: {} // { level: roleId } - maps level numbers to role IDs
    },
    welcome: {
        enabled: true,
        channelName: 'welcome',
        customMessage: null
    },
    leave: {
        enabled: true,
        channelName: 'general',
        customMessage: null
    },
    keywords: {
        enabled: true,
        list: Object.keys(ps3ErrorCodes), // Will be replaced on first access
        customResponse: null
    },
    autoNickname: {
        enabled: false,
        prefix: '',
        suffix: ''
    },
    logs: {
        enabled: false,
        criticalChannel: null // Channel ID for critical error logs
    },
    raidProtection: {
        enabled: false,
        joinThreshold: 5, // Number of joins
        timeWindow: 10, // Within X seconds
        action: 'kick', // 'kick', 'ban', or 'none'
        whitelist: [], // Array of user IDs to never action
        notificationChannel: null, // Channel to notify about raids
        lockdownDuration: 300 // Seconds to keep server locked (0 = manual unlock)
    },
    moderation: {
        enabled: true,
        warningThreshold: 3, // Number of warnings before auto-action
        autoAction: 'timeout', // 'timeout', 'kick', 'ban', or 'none'
        timeoutDuration: 600, // Seconds for timeout (default 10 min)
        muteRole: null, // Role ID for muting users
        modLogChannel: null, // Channel for moderation logs
        dmOnAction: true, // DM users when they're warned/punished
        warningDecay: 0, // Days before warnings expire (0 = never)
        autoDeleteWarnings: false, // Auto-delete warnings after threshold action
        moderatorRoles: [] // Role IDs that can use moderation commands
    },
    serverStats: {
        enabled: false,
        updateInterval: 300000, // 5 minutes in milliseconds
        channels: {
            memberCount: null,
            botCount: null,
            totalCount: null,
            statusChannel: null
        },
        channelNames: {
            memberCount: "👥 Members: {count}",
            botCount: "🤖 Bots: {count}",
            totalCount: "🌟・Members: {count}",
            statusChannel: "🟢 Status: {status}"
        }
    },
    ai: {
        enabled: true, // Changed to true by default
        channelName: "ai-chat", // Channel name where AI responds automatically
        channelId: "1431740126546890843", // Channel ID where AI responds
        model: "deepseek-chat",
        systemPrompt: "You are a helpful AI assistant for the PlayStation Homebrew Discord server. When someone asks a question, your PRIMARY GOAL is to answer it directly and thoroughly. Focus on giving complete, accurate information. Avoid puns, wordplay, and jokes when people are asking for help - they want real answers, not entertainment. Be friendly and approachable, but prioritize being informative and helpful above all else. For casual chat you can be more relaxed, but when people ask questions (especially with words like 'how', 'what', 'why', 'help', 'problem', 'error'), give them straight, clear answers. You're knowledgeable about PlayStation homebrew, modding, and tech. Explain things clearly and thoroughly. Use British spelling (colour, favourite, realise). CONTENT POLICY: Casual swearing is fine (fuck, shit, bloody hell, etc.) when natural. Never engage with racist content, political discussions, hate speech, or harmful topics - politely decline.",
        maxHistory: 6, // Reduced from 10 for faster processing
        temperature: 1.2 // Reduced from 1.5 for more focused responses
    }
};

// --- Scheduled restart at 00:00 every day ---
function scheduleMidnightRestart() {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0); // Next midnight
    const msUntilMidnight = nextMidnight - now;
    setTimeout(() => {
        console.log('🔄 Scheduled restart: Restarting bot for daily maintenance.');
        process.exit(0); // Let your process manager restart the bot
    }, msUntilMidnight);
}
scheduleMidnightRestart();
// --- End scheduled restart ---

// Load existing user data
function loadUserData() {
    try {
        if (fsSync.existsSync(userDataFile)) {
            userData = JSON.parse(fsSync.readFileSync(userDataFile, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        userData = {};
    }
}

// Optimized debounced save function - reduces code duplication
function createDebouncedSave(filePath, getData, delay = 3000) {
    let timer = null;
    return function() {
        clearTimeout(timer);
        timer = setTimeout(() => saveJSON(filePath, getData()), delay);
    };
}

// Initialize save functions
const saveUserData = createDebouncedSave(userDataFile, () => userData, 5000);
const saveSettings = createDebouncedSave(settingsFile, () => serverSettings, 3000);
const saveTicketData = createDebouncedSave(ticketDataFile, () => ticketData, 1000);
const saveModerationData = createDebouncedSave(moderationDataFile, () => moderationData, 1000);

// Load server settings
async function loadSettings() {
    try {
        await fs.access(settingsFile);
        const data = await fs.readFile(settingsFile, 'utf8');
        serverSettings = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading server settings:', error);
        }
        serverSettings = {};
    }
}

// Get settings for a guild (with defaults)
function getGuildSettings(guildId) {
    if (!serverSettings[guildId]) {
        serverSettings[guildId] = JSON.parse(JSON.stringify(defaultSettings));
        saveSettings();
    }
    return serverSettings[guildId];
}

// Load ticket data
async function loadTicketData() {
    try {
        await fs.access(ticketDataFile);
        const data = await fs.readFile(ticketDataFile, 'utf8');
        ticketData = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading ticket data:', error);
        }
        ticketData = {};
    }
}

// Load moderation data
async function loadModerationData() {
    try {
        await fs.access(moderationDataFile);
        const data = await fs.readFile(moderationDataFile, 'utf8');
        moderationData = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading moderation data:', error);
        }
        moderationData = {};
    }
}

// Initialize moderation data for a guild - optimized
function initializeModerationData(guildId) {
    if (!moderationData[guildId]) {
        moderationData[guildId] = { warnings: {}, infractions: {}, mutedUsers: [] };
        saveModerationData();
    }
}

// Check if user is a moderator - optimized
function isModerator(member, settings) {
    if (member.permissions.has(PermissionFlagsBits.Administrator | PermissionFlagsBits.ModerateMembers)) return true;
    return settings.moderation?.moderatorRoles?.some(roleId => member.roles.cache.has(roleId)) || false;
}

// Log moderation action
async function logModerationAction(guild, action, moderator, target, reason, additional = {}) {
    try {
        // Use new comprehensive logging system
        await logEvent(guild, 'moderation', {
            action: action,
            user: target.tag || target,
            userId: target.id,
            moderator: `${moderator.tag} (${moderator.id})`,
            reason: reason || 'No reason provided',
            duration: additional.duration,
            color: action.includes('Ban') || action.includes('Kick') ? 0xFF0000 : 
                   action.includes('Warn') ? 0xFFAA00 : 
                   action.includes('Mute') || action.includes('Timeout') ? 0xFFA500 : 0x00FF00
        });
        
        // Legacy moderation channel (keep for backwards compatibility)
        const settings = getGuildSettings(guild.id);
        if (!settings.moderation || !settings.moderation.modLogChannel) return;
        
        const logChannel = await guild.channels.fetch(settings.moderation.modLogChannel).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        
        const embed = new EmbedBuilder()
            .setTitle(`${action} | Case #${Date.now().toString().slice(-6)}`)
            .setColor(action.includes('Ban') || action.includes('Kick') ? 0xFF0000 : 
                     action.includes('Warn') ? 0xFFAA00 : 
                     action.includes('Mute') || action.includes('Timeout') ? 0xFFA500 : 0x00FF00)
            .addFields(
                { name: 'User', value: `${target.tag || target} (${target.id})`, inline: true },
                { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
                { name: 'Reason', value: reason || 'No reason provided', inline: false }
            )
            .setTimestamp();
        
        if (additional.duration) {
            embed.addFields({ name: 'Duration', value: additional.duration, inline: true });
        }
        if (additional.warnings) {
            embed.addFields({ name: 'Total Warnings', value: additional.warnings.toString(), inline: true });
        }
        
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging moderation action:', error);
    }
}

// Add warning to user
async function addWarning(guildId, userId, moderatorId, reason) {
    initializeModerationData(guildId);
    
    if (!moderationData[guildId].warnings[userId]) {
        moderationData[guildId].warnings[userId] = [];
    }
    
    const warning = {
        id: Date.now(),
        moderatorId,
        reason,
        timestamp: new Date().toISOString()
    };
    
    moderationData[guildId].warnings[userId].push(warning);
    saveModerationData();
    
    return moderationData[guildId].warnings[userId].length;
}

// Comprehensive logging function
async function logEvent(guild, eventType, data) {
    try {
        const settings = getGuildSettings(guild.id);
        if (!settings.logging || !settings.logging.enabled) return;
        if (!settings.logging.logTypes[eventType]) return;
        
        let channelType = null;
        let embed = new EmbedBuilder().setTimestamp();
        
        // Determine which channel to use and create embed
        switch (eventType) {
            case 'critical':
                channelType = 'critical';
                embed.setTitle('🔴 Critical Error')
                    .setColor(0xFF0000)
                    .setDescription(`\`\`\`${data.error}\`\`\``)
                    .addFields({ name: 'Stack Trace', value: `\`\`\`${data.stack?.substring(0, 1000) || 'No stack trace'}\`\`\`` });
                break;
                
            case 'moderation':
                channelType = 'moderation';
                embed.setTitle(`⚖️ ${data.action}`)
                    .setColor(data.color || 0xFFAA00)
                    .addFields(
                        { name: 'User', value: `${data.user} (${data.userId})`, inline: true },
                        { name: 'Moderator', value: `${data.moderator}`, inline: true },
                        { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
                    );
                if (data.duration) embed.addFields({ name: 'Duration', value: data.duration, inline: true });
                break;
                
            case 'messageDelete':
                channelType = 'messages';
                embed.setTitle('💬 Message Deleted')
                    .setColor(0xFF6B6B)
                    .addFields(
                        { name: 'Author', value: `${data.author} (${data.authorId})`, inline: true },
                        { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                        { name: 'Content', value: data.content?.substring(0, 1000) || 'No content', inline: false }
                    );
                if (data.attachments) embed.addFields({ name: 'Attachments', value: data.attachments, inline: false });
                break;
                
            case 'messageEdit':
                channelType = 'messages';
                embed.setTitle('✏️ Message Edited')
                    .setColor(0xFFA500)
                    .addFields(
                        { name: 'Author', value: `${data.author} (${data.authorId})`, inline: true },
                        { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                        { name: 'Before', value: data.oldContent?.substring(0, 500) || 'No content', inline: false },
                        { name: 'After', value: data.newContent?.substring(0, 500) || 'No content', inline: false },
                        { name: 'Jump to Message', value: `[Click Here](${data.messageUrl})`, inline: false }
                    );
                break;
                
            case 'memberJoin':
                channelType = 'members';
                embed.setTitle('👋 Member Joined')
                    .setColor(0x00FF00)
                    .setThumbnail(data.avatarUrl)
                    .addFields(
                        { name: 'User', value: `${data.user} (${data.userId})`, inline: true },
                        { name: 'Account Created', value: `<t:${data.createdTimestamp}:R>`, inline: true },
                        { name: 'Member Count', value: `${data.memberCount}`, inline: true }
                    );
                break;
                
            case 'memberLeave':
                channelType = 'members';
                embed.setTitle('👋 Member Left')
                    .setColor(0xFF0000)
                    .setThumbnail(data.avatarUrl)
                    .addFields(
                        { name: 'User', value: `${data.user} (${data.userId})`, inline: true },
                        { name: 'Joined Server', value: data.joinedAt ? `<t:${data.joinedAt}:R>` : 'Unknown', inline: true },
                        { name: 'Member Count', value: `${data.memberCount}`, inline: true }
                    );
                if (data.roles) embed.addFields({ name: 'Roles', value: data.roles, inline: false });
                break;
                
            case 'roleChange':
                channelType = 'members';
                embed.setTitle('🎭 Roles Updated')
                    .setColor(0x3498DB)
                    .addFields(
                        { name: 'User', value: `${data.user}`, inline: true },
                        { name: 'Action', value: data.action, inline: true }
                    );
                if (data.added) embed.addFields({ name: 'Added Roles', value: data.added, inline: false });
                if (data.removed) embed.addFields({ name: 'Removed Roles', value: data.removed, inline: false });
                break;
                
            case 'voiceJoin':
            case 'voiceLeave':
                channelType = 'voice';
                const isJoin = eventType === 'voiceJoin';
                embed.setTitle(isJoin ? '🔊 Voice Join' : '🔇 Voice Leave')
                    .setColor(isJoin ? 0x00FF00 : 0xFF6B6B)
                    .addFields(
                        { name: 'User', value: `${data.user}`, inline: true },
                        { name: 'Channel', value: `<#${data.channelId}>`, inline: true }
                    );
                break;
                
            case 'channelCreate':
                channelType = 'server';
                embed.setTitle('🛠️ Channel Created')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                        { name: 'Type', value: data.type, inline: true }
                    );
                break;
                
            case 'channelDelete':
                channelType = 'server';
                embed.setTitle('🗑️ Channel Deleted')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'Channel', value: data.channelName, inline: true },
                        { name: 'Type', value: data.type, inline: true }
                    );
                break;
                
            case 'keywordFlag':
                channelType = 'keywords';
                embed.setTitle('🚨 Keyword Flagged')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'User', value: `${data.user} (${data.userId})`, inline: true },
                        { name: 'Channel', value: `<#${data.channelId}>`, inline: true },
                        { name: 'Keyword', value: `\`${data.keyword}\``, inline: true },
                        { name: 'Message', value: data.content?.substring(0, 1000) || 'No content', inline: false },
                        { name: 'Jump to Message', value: `[Click Here](${data.messageUrl})`, inline: false }
                    );
                break;
                
            default:
                return;
        }
        
        if (!channelType || !settings.logging.channels[channelType]) return;
        
        const logChannel = await guild.channels.fetch(settings.logging.channels[channelType]).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging event:', error);
    }
}

// Add infraction to user
function addInfraction(guildId, userId, type, moderatorId, reason) {
    initializeModerationData(guildId);
    
    if (!moderationData[guildId].infractions[userId]) {
        moderationData[guildId].infractions[userId] = [];
    }
    
    const infraction = {
        id: Date.now(),
        type, // warn, timeout, kick, ban, mute
        moderatorId,
        reason,
        timestamp: new Date().toISOString()
    };
    
    moderationData[guildId].infractions[userId].push(infraction);
    saveModerationData();
}

// Critical error logging function
async function logCriticalError(error, context = 'Unknown', guildId = null) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ${context}: ${error.message || error}`;
    
    console.error(`[CRITICAL] ${context}:`, error);
    
    // Use new comprehensive logging system
    if (guildId) {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                await logEvent(guild, 'critical', {
                    error: `${context}: ${error.message || error}`,
                    stack: error.stack || 'No stack trace available'
                });
            }
        } catch (logError) {
            console.error('Failed to log critical error:', logError);
        }
    } else if (client.guilds) {
        // Send to all guilds with critical logging enabled
        for (const [id, guild] of client.guilds.cache) {
            try {
                await logEvent(guild, 'critical', {
                    error: `${context}: ${error.message || error}`,
                    stack: error.stack || 'No stack trace available'
                });
            } catch (logError) {
                // Silently fail for individual guilds
            }
        }
    }
}

// Helper function to check admin permissions (optimization - reduces code duplication)
function requireAdmin(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        interaction.reply({ content: '❌ You need Administrator permissions to use this command!', ephemeral: true });
        return false;
    }
    return true;
}

// Helper function to create standardized error embed
function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFF0000)
        .setTimestamp();
}

// Helper function to create standardized success embed
function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x00FF00)
        .setTimestamp();
}

// Helper function to create standardized info embed
function createInfoEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x0099FF)
        .setTimestamp();
}

// Initialize ticket system for a guild
function initializeTicketSystem(guildId) {
    if (!ticketData[guildId]) {
        ticketData[guildId] = {
            counter: 0,
            tickets: {},
            categoryId: null,
            settings: {
                enabled: false,
                staffRoleId: null,
                ticketMessage: '**Welcome to your support ticket!**\n\n🎫 Our support team will be with you shortly.\n\n**Please describe your issue in detail:**\n• What is the problem?\n• When did it start?\n• Have you tried any solutions?\n\n**Available Actions:**\n🔔 Click "Claim Ticket" to take ownership (Staff only)\n🔒 Click "Close Ticket" to close this ticket',
                closedMessage: 'Thank you for contacting support! 🙏\n\nIf you need additional assistance, feel free to open a new ticket by clicking the button on the ticket panel!',
                categoryName: '🎫 Tickets'
            }
        };
        saveTicketData();
    }
    // Add default settings if they don't exist (for existing data)
    if (!ticketData[guildId].settings) {
        ticketData[guildId].settings = {
            enabled: false,
            staffRoleId: null,
            ticketMessage: '**Welcome to your support ticket!**\n\n🎫 Our support team will be with you shortly.\n\n**Please describe your issue in detail:**\n• What is the problem?\n• When did it start?\n• Have you tried any solutions?\n\n**Available Actions:**\n🔔 Click "Claim Ticket" to take ownership (Staff only)\n🔒 Click "Close Ticket" to close this ticket',
            closedMessage: 'Thank you for contacting support! 🙏\n\nIf you need additional assistance, feel free to open a new ticket by clicking the button on the ticket panel!',
            categoryName: '🎫 Tickets'
        };
        saveTicketData();
    }
}

// Generate transcript from channel messages
async function generateTranscript(channel) {
    try {
        let transcript = `╔═══════════════════════════════════════════════════════════╗\n`;
        transcript += `║           TICKET TRANSCRIPT - ${channel.name.toUpperCase()}              ║\n`;
        transcript += `╚═══════════════════════════════════════════════════════════╝\n\n`;
        transcript += `📅 Created: ${channel.createdAt.toLocaleString()}\n`;
        transcript += `📍 Channel: #${channel.name}\n`;
        transcript += `🆔 Channel ID: ${channel.id}\n`;
        transcript += `═══════════════════════════════════════════════════════════\n\n`;
        
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).reverse();
        
        for (const msg of sortedMessages) {
            const timestamp = msg.createdAt.toLocaleString();
            const author = msg.author.tag;
            const authorId = msg.author.id;
            const content = msg.content || '[Embed/Attachment/Button Interaction]';
            
            transcript += `[${timestamp}]\n`;
            transcript += `👤 ${author} (${authorId})\n`;
            transcript += `💬 ${content}\n`;
            
            if (msg.attachments.size > 0) {
                transcript += `📎 Attachments:\n`;
                transcript += msg.attachments.map(att => `   - ${att.name} (${att.url})`).join('\n') + '\n';
            }
            
            if (msg.embeds.length > 0) {
                transcript += `📋 Embeds: ${msg.embeds.length}\n`;
            }
            
            transcript += `───────────────────────────────────────────────────────────\n`;
        }
        
        transcript += `\n═══════════════════════════════════════════════════════════\n`;
        transcript += `📊 Total Messages: ${sortedMessages.length}\n`;
        transcript += `⏱️ Transcript Generated: ${new Date().toLocaleString()}\n`;
        transcript += `═══════════════════════════════════════════════════════════\n`;
        
        return transcript;
    } catch (error) {
        console.error('Error generating transcript:', error);
        return null;
    }
}

// XP calculation cache to improve performance
const xpCache = new Map();
const levelCache = new Map();

// Pre-compiled error code regex cache (optimization)
const errorCodeRegexCache = new Map();

// Cache error code keys for performance
const errorCodeKeys = Object.keys(ps3ErrorCodes);

// Pre-compute error code categories for instant lookup (optimization)
const errorCodeCategories = new Map();
for (const [code, description] of Object.entries(ps3ErrorCodes)) {
    // Skip metadata entries (they start with underscore)
    if (code.startsWith('_') || typeof description !== 'string') continue;
    
    if (description.startsWith('CFW:')) {
        errorCodeCategories.set(code, { name: '🟣 Custom Firmware', color: 0x9B59B6 });
    } else if (description.startsWith('SYSCON:')) {
        errorCodeCategories.set(code, { name: '🔴 Hardware (SYSCON)', color: 0xE74C3C });
    } else {
        errorCodeCategories.set(code, { name: '🔵 Original PS3 Errors', color: 0x3498DB });
    }
}

// Channel cache for faster lookups (guildId:channelName -> channel object)
const channelCache = new Map();

// Raid protection tracking
const joinTracker = new Map(); // guildId -> array of {userId, timestamp}
const lockedServers = new Set(); // Set of guildIds currently in lockdown
const lockdownTimers = new Map(); // guildId -> setTimeout reference

// Raid detection and handling
async function checkForRaid(guild) {
    try {
        const settings = serverSettings[guild.id] || defaultSettings;
        if (!settings.raidProtection.enabled) return;

        const now = Date.now();
        const timeWindow = settings.raidProtection.timeWindow * 1000; // Convert to ms
        const joins = joinTracker.get(guild.id) || [];
        
        // Filter joins within time window
        const recentJoins = joins.filter(j => now - j.timestamp < timeWindow);
        joinTracker.set(guild.id, recentJoins);
        
        // Check if threshold exceeded
        if (recentJoins.length >= settings.raidProtection.joinThreshold) {
            await handleRaid(guild, recentJoins);
        }
    } catch (error) {
        console.error('Error checking for raid:', error);
        logCriticalError(error, 'Raid Detection System', guild.id);
    }
}

async function handleRaid(guild, suspiciousJoins) {
    try {
        const settings = serverSettings[guild.id];
        
        // Prevent duplicate raid triggers
        if (lockedServers.has(guild.id)) return;
        lockedServers.add(guild.id);
        
        console.log(`🚨 RAID DETECTED in ${guild.name}! ${suspiciousJoins.length} joins in ${settings.raidProtection.timeWindow}s`);
        
        // Send notification
        if (settings.raidProtection.notificationChannel) {
            try {
                const channel = await guild.channels.fetch(settings.raidProtection.notificationChannel);
                if (channel) {
                    const raidEmbed = new EmbedBuilder()
                        .setTitle('🚨 RAID DETECTED')
                        .setDescription(`Detected ${suspiciousJoins.length} members joining within ${settings.raidProtection.timeWindow} seconds!`)
                        .setColor(0xFF0000)
                        .addFields(
                            { name: 'Action Taken', value: settings.raidProtection.action === 'none' ? 'None (monitoring only)' : `Auto-${settings.raidProtection.action}`, inline: true },
                            { name: 'Server Status', value: '🔒 Lockdown Active', inline: true },
                            { name: 'Suspicious Members', value: suspiciousJoins.slice(0, 10).map(j => `<@${j.userId}>`).join(', ') + (suspiciousJoins.length > 10 ? `\n...and ${suspiciousJoins.length - 10} more` : ''), inline: false }
                        )
                        .setTimestamp();
                    
                    await channel.send({ embeds: [raidEmbed] });
                }
            } catch (error) {
                console.error('Error sending raid notification:', error);
            }
        }
        
        // Take action on raiders
        if (settings.raidProtection.action !== 'none') {
            for (const join of suspiciousJoins) {
                try {
                    // Skip whitelisted users
                    if (settings.raidProtection.whitelist.includes(join.userId)) continue;
                    
                    const member = await guild.members.fetch(join.userId).catch(() => null);
                    if (!member) continue;
                    
                    // Don't action server owner or members with admin
                    if (member.id === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) continue;
                    
                    if (settings.raidProtection.action === 'kick') {
                        await member.kick('Raid protection - suspicious join pattern');
                        console.log(`⚠️ Kicked ${member.user.tag} (Raid protection)`);
                    } else if (settings.raidProtection.action === 'ban') {
                        await member.ban({ reason: 'Raid protection - suspicious join pattern', deleteMessageSeconds: 0 });
                        console.log(`🔨 Banned ${member.user.tag} (Raid protection)`);
                    }
                } catch (error) {
                    console.error(`Error actioning user ${join.userId}:`, error);
                }
            }
        }
        
        // Auto-unlock after duration (if configured)
        if (settings.raidProtection.lockdownDuration > 0) {
            const unlockTimer = setTimeout(() => {
                lockedServers.delete(guild.id);
                lockdownTimers.delete(guild.id);
                console.log(`🔓 Raid lockdown lifted for ${guild.name}`);
                
                // Send unlock notification
                if (settings.raidProtection.notificationChannel) {
                    guild.channels.fetch(settings.raidProtection.notificationChannel)
                        .then(channel => {
                            const unlockEmbed = new EmbedBuilder()
                                .setTitle('🔓 Lockdown Ended')
                                .setDescription('Raid protection lockdown has been automatically lifted.')
                                .setColor(0x00FF00)
                                .setTimestamp();
                            channel.send({ embeds: [unlockEmbed] });
                        })
                        .catch(() => {});
                }
            }, settings.raidProtection.lockdownDuration * 1000);
            
            lockdownTimers.set(guild.id, unlockTimer);
        }
        
        // Clear join tracker for this guild
        joinTracker.delete(guild.id);
        
    } catch (error) {
        console.error('Error handling raid:', error);
        logCriticalError(error, 'Raid Handler', guild.id);
    }
}

// Calculate XP required for a specific level (cached)
function getXPForLevel(level) {
    if (xpCache.has(level)) return xpCache.get(level);
    const xp = Math.floor(100 * Math.pow(1.2, level - 1));
    xpCache.set(level, xp);
    return xp;
}

// Calculate level from total XP (optimized with cache)
function getLevelFromXP(xp) {
    const cacheKey = Math.floor(xp / 100);
    if (levelCache.has(cacheKey)) {
        const cached = levelCache.get(cacheKey);
        if (cached.minXP <= xp && cached.maxXP > xp) return cached.level;
    }
    
    let level = 1;
    let totalXP = 0;
    
    while (level <= 100) {
        const xpForLevel = getXPForLevel(level);
        if (totalXP + xpForLevel > xp) break;
        totalXP += xpForLevel;
        level++;
    }
    
    const finalLevel = Math.min(level, 100);
    levelCache.set(cacheKey, { level: finalLevel, minXP: totalXP, maxXP: totalXP + getXPForLevel(finalLevel) });
    return finalLevel;
}

// Get XP progress for current level
function getXPProgress(xp) {
    const currentLevel = getLevelFromXP(xp);
    let totalXPForPreviousLevels = 0;
    for (let i = 1; i < currentLevel; i++) {
        totalXPForPreviousLevels += getXPForLevel(i);
    }
    const currentLevelXP = xp - totalXPForPreviousLevels;
    const xpRequiredForCurrentLevel = getXPForLevel(currentLevel);
    return { currentLevelXP, xpRequiredForCurrentLevel, totalXP: xp, level: currentLevel };
}

// Initialize user data if not exists
function initializeUser(userId) {
    if (!userData[userId]) {
        userData[userId] = { xp: 0, level: 1, lastMessage: 0 };
    }
}

// Add XP to user and check for level up
function addXP(userId, amount, maxLevel = 100) {
    initializeUser(userId);
    const oldLevel = userData[userId].level;
    userData[userId].xp += amount;
    userData[userId].level = Math.min(getLevelFromXP(userData[userId].xp), maxLevel);
    saveUserData();
    return { leveledUp: userData[userId].level > oldLevel, newLevel: userData[userId].level, oldLevel };
}

// Helper function to find channel with caching
function findChannel(guild, channelName) {
    const cacheKey = `${guild.id}:${channelName}`;
    
    // Check cache first
    if (channelCache.has(cacheKey)) {
        const cached = channelCache.get(cacheKey);
        // Verify channel still exists
        if (guild.channels.cache.has(cached.id)) {
            return cached;
        }
        // Remove stale cache entry
        channelCache.delete(cacheKey);
    }
    
    // Find channel and cache it
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (channel) {
        channelCache.set(cacheKey, channel);
    }
    return channel;
}

// Server Stats Update Function
async function updateServerStats(guild) {
    const settings = getGuildSettings(guild.id);
    
    if (!settings.serverStats || !settings.serverStats.enabled) return;
    
    try {
        await guild.members.fetch(); // Fetch all members
        
        const members = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const total = guild.memberCount;
        
        // Track last update time to prevent rate limiting (Discord allows ~2 name changes per 10 minutes)
        if (!settings.serverStats.lastUpdate) {
            settings.serverStats.lastUpdate = {};
        }
        
        const now = Date.now();
        const rateLimitWindow = 600000; // 10 minutes in ms
        
        // Update Member Count Channel
        if (settings.serverStats.channels.memberCount) {
            const memberChannel = guild.channels.cache.get(settings.serverStats.channels.memberCount);
            if (memberChannel && memberChannel.isVoiceBased()) {
                const newName = settings.serverStats.channelNames.memberCount.replace('{count}', members);
                const lastUpdate = settings.serverStats.lastUpdate.memberCount || 0;
                
                // Only update if name changed AND enough time has passed since last update
                if (memberChannel.name !== newName && (now - lastUpdate >= rateLimitWindow)) {
                    await memberChannel.setName(newName).catch(err => 
                        console.error('Error updating member count channel:', err.message)
                    );
                    settings.serverStats.lastUpdate.memberCount = now;
                    saveSettings();
                }
            } else if (settings.serverStats.channels.memberCount) {
                // Channel was deleted, reset to null
                console.log(`⚠️ Member count channel deleted in ${guild.name}, resetting...`);
                settings.serverStats.channels.memberCount = null;
                saveSettings();
            }
        }
        
        // Update Bot Count Channel
        if (settings.serverStats.channels.botCount) {
            const botChannel = guild.channels.cache.get(settings.serverStats.channels.botCount);
            if (botChannel && botChannel.isVoiceBased()) {
                const newName = settings.serverStats.channelNames.botCount.replace('{count}', bots);
                const lastUpdate = settings.serverStats.lastUpdate.botCount || 0;
                
                // Only update if name changed AND enough time has passed since last update
                if (botChannel.name !== newName && (now - lastUpdate >= rateLimitWindow)) {
                    await botChannel.setName(newName).catch(err => 
                        console.error('Error updating bot count channel:', err.message)
                    );
                    settings.serverStats.lastUpdate.botCount = now;
                    saveSettings();
                }
            } else if (settings.serverStats.channels.botCount) {
                // Channel was deleted, reset to null
                console.log(`⚠️ Bot count channel deleted in ${guild.name}, resetting...`);
                settings.serverStats.channels.botCount = null;
                saveSettings();
            }
        }
        
        // Update Total Count Channel
        if (settings.serverStats.channels.totalCount) {
            const totalChannel = guild.channels.cache.get(settings.serverStats.channels.totalCount);
            if (totalChannel && totalChannel.isVoiceBased()) {
                const newName = settings.serverStats.channelNames.totalCount.replace('{count}', total);
                const lastUpdate = settings.serverStats.lastUpdate.totalCount || 0;
                
                // Only update if name changed AND enough time has passed since last update
                if (totalChannel.name !== newName && (now - lastUpdate >= rateLimitWindow)) {
                    await totalChannel.setName(newName).catch(err => 
                        console.error('Error updating total count channel:', err.message)
                    );
                    settings.serverStats.lastUpdate.totalCount = now;
                    saveSettings();
                }
            } else if (settings.serverStats.channels.totalCount) {
                // Channel was deleted, reset to null
                console.log(`⚠️ Total count channel deleted in ${guild.name}, resetting...`);
                settings.serverStats.channels.totalCount = null;
                saveSettings();
            }
        }
        
        // Update Status Channel
        if (settings.serverStats.channels.statusChannel) {
            const statusChannel = guild.channels.cache.get(settings.serverStats.channels.statusChannel);
            if (statusChannel && statusChannel.isVoiceBased()) {
                const status = 'Online';
                const emoji = '🟢';
                const newName = settings.serverStats.channelNames.statusChannel
                    .replace('{status}', status)
                    .replace('🟢', emoji)
                    .replace('🔴', emoji);
                const lastUpdate = settings.serverStats.lastUpdate.statusChannel || 0;
                
                // Only update if name changed AND enough time has passed since last update
                if (statusChannel.name !== newName && (now - lastUpdate >= rateLimitWindow)) {
                    await statusChannel.setName(newName).catch(err => 
                        console.error('Error updating status channel:', err.message)
                    );
                    settings.serverStats.lastUpdate.statusChannel = now;
                    saveSettings();
                }
            } else if (settings.serverStats.channels.statusChannel) {
                // Channel was deleted, reset to null
                console.log(`⚠️ Status channel deleted in ${guild.name}, resetting...`);
                settings.serverStats.channels.statusChannel = null;
                saveSettings();
            }
        }
    } catch (error) {
        console.error('Error in updateServerStats:', error.message);
    }
}

// Start Server Stats Update Intervals
function startServerStatsUpdates() {
    client.guilds.cache.forEach(guild => {
        const settings = getGuildSettings(guild.id);
        
        if (settings.serverStats && settings.serverStats.enabled) {
            // Initial update
            updateServerStats(guild);
            
            // Set interval for continuous updates
            setInterval(() => {
                updateServerStats(guild);
            }, settings.serverStats.updateInterval || 300000);
        }
    });
}

// Bot ready event
client.once('clientReady', async () => {
    console.log(`✅ ${client.user.tag} is online and ready!`);
    console.log(`🤖 Bot is in ${client.guilds.cache.size} server(s)`);
    console.log(`⚡ Low-end PC optimizations enabled`);
    console.log(`💾 Memory optimizations: Active`);
    console.log(`🧹 Cache limits: 50 XP | 500 levels | 25 channels`);
    
    // Set bot activity
    client.user.setActivity('PSHomebrew Community', { type: ActivityType.Watching });
    
    // Load user data and settings
    loadUserData();
    loadSettings();
    loadTicketData();
    loadModerationData();
    
    // Start server stats updates
    startServerStatsUpdates();
    
    // Start YouTube notifications
    startYouTubeMonitoring();
});

// YouTube monitoring system
function startYouTubeMonitoring() {
    const ytDataPath = './features/youtubeNotifications.json';
    
    async function checkYouTubeChannels() {
        try {
            const ytData = JSON.parse(fsSync.readFileSync(ytDataPath, 'utf8'));
            
            for (const [guildId, config] of Object.entries(ytData)) {
                if (!config.enabled || !config.notificationChannelId || config.channels.length === 0) continue;
                
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;
                
                const notifChannel = guild.channels.cache.get(config.notificationChannelId);
                if (!notifChannel) continue;
                
                for (const ytChannel of config.channels) {
                    try {
                        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ytChannel.channelId}`;
                        const feed = await rssParser.parseURL(feedUrl);
                        
                        if (!feed.items || feed.items.length === 0) continue;
                        
                        const latestVideo = feed.items[0];
                        const videoId = latestVideo.id.split(':')[2];
                        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                        
                        // Check if we've already posted this video
                        if (config.lastChecked[ytChannel.channelId] === videoId) continue;
                        
                        // Update last checked
                        config.lastChecked[ytChannel.channelId] = videoId;
                        fsSync.writeFileSync(ytDataPath, JSON.stringify(ytData, null, 2));
                        
                        // Build custom message
                        let customMsg = config.customMessage
                            .replace(/{channelName}/g, ytChannel.name)
                            .replace(/{title}/g, latestVideo.title)
                            .replace(/{url}/g, videoUrl)
                            .replace(/{description}/g, latestVideo.contentSnippet || 'No description');
                        
                        // Create embed
                        const embed = new EmbedBuilder()
                            .setTitle(latestVideo.title)
                            .setURL(videoUrl)
                            .setDescription(latestVideo.contentSnippet?.substring(0, 200) || 'No description available')
                            .setColor(0xFF0000)
                            .setAuthor({ name: ytChannel.name, iconURL: 'https://www.youtube.com/s/desktop/d743f786/img/favicon_144x144.png' })
                            .setThumbnail(latestVideo.media?.thumbnail?.url || null)
                            .setTimestamp(new Date(latestVideo.pubDate))
                            .setFooter({ text: 'YouTube' });
                        
                        await notifChannel.send({ content: customMsg, embeds: [embed] });
                        console.log(`📺 Posted new video from ${ytChannel.name} in ${guild.name}`);
                        
                    } catch (error) {
                        console.error(`❌ Error checking YouTube channel ${ytChannel.name}:`, error.message);
                    }
                }
            }
        } catch (error) {
            // Ignore if file doesn't exist yet
            if (error.code !== 'ENOENT') {
                console.error('❌ YouTube monitoring error:', error);
            }
        }
    }
    
    // Initial check after 30 seconds
    setTimeout(checkYouTubeChannels, 30000);
    
    // Set up periodic checking (will use each guild's interval)
    setInterval(async () => {
        try {
            const ytData = JSON.parse(fsSync.readFileSync(ytDataPath, 'utf8'));
            for (const [guildId, config] of Object.entries(ytData)) {
                if (config.enabled) {
                    checkYouTubeChannels();
                    break; // Only need to call once for all guilds
                }
            }
        } catch (error) {
            // Silent fail
        }
    }, 300000); // Check every 5 minutes (will respect individual guild intervals in future update)
    
    console.log('📺 YouTube monitoring started');
}

// Message event for XP system and keyword detection
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const settings = getGuildSettings(message.guild.id);
    const userId = message.author.id;
    const now = Date.now();
    
    // Bot owner mention to unlock AI
    if (message.mentions.has(client.user) && userId === config.botOwnerId && isAILocked(message.guild.id)) {
        const lockInfo = aiLockdown[message.guild.id];
        unlockAI(message.guild.id);
        
        const unlockEmbed = new EmbedBuilder()
            .setTitle('🔓 AI Chat Re-enabled')
            .setDescription('AI chat has been unlocked and is now available again.')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Previously Locked By', value: lockInfo.lockedByUsername, inline: true },
                { name: 'Reason', value: lockInfo.reason, inline: true },
                { name: 'Duration', value: `${Math.floor((now - lockInfo.timestamp) / 1000 / 60)} minutes`, inline: true }
            )
            .setTimestamp();
        
        await message.reply({ embeds: [unlockEmbed] });
        return;
    }
    
    // Leveling system
    if (settings.leveling.enabled) {
        initializeUser(userId);
        
        // XP cooldown - but don't return yet, AI should still work
        if (now - userData[userId].lastMessage >= settings.leveling.cooldown) {
            userData[userId].lastMessage = now;
            
            // Add random XP based on settings
            const xpGained = Math.floor(Math.random() * (settings.leveling.maxXP - settings.leveling.minXP + 1)) + settings.leveling.minXP;
            const result = addXP(userId, xpGained, settings.leveling.maxLevel);
        
            // Check for level up
            if (result.leveledUp && settings.leveling.showLevelUpMessages) {
                // Handle level roles - remove old level role and add new level role
                const member = message.member;
                if (member && settings.leveling.levelRoles) {
                    // Remove the old level role if it exists
                    const oldLevelRole = settings.leveling.levelRoles[result.oldLevel];
                    if (oldLevelRole) {
                        const oldRole = message.guild.roles.cache.get(oldLevelRole);
                        if (oldRole && member.roles.cache.has(oldLevelRole)) {
                            try {
                                await member.roles.remove(oldRole);
                            } catch (error) {
                                console.error('Error removing old level role:', error);
                            }
                        }
                    }
                    
                    // Add the new level role if it exists
                    const newLevelRole = settings.leveling.levelRoles[result.newLevel];
                    if (newLevelRole) {
                        const newRole = message.guild.roles.cache.get(newLevelRole);
                        if (newRole && !member.roles.cache.has(newLevelRole)) {
                            try {
                                await member.roles.add(newRole);
                            } catch (error) {
                                console.error('Error adding new level role:', error);
                            }
                        }
                    }
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Level Up!')
                    .setDescription(`Congratulations ${message.author}! You've reached **Level ${result.newLevel}**!`)
                    .setColor(0x00FF00)
                    .setThumbnail(message.author.displayAvatarURL())
                    .addFields(
                        { name: '📈 Previous Level', value: result.oldLevel.toString(), inline: true },
                        { name: '⭐ New Level', value: result.newLevel.toString(), inline: true },
                        { name: '🎯 XP Gained', value: xpGained.toString(), inline: true }
                    )
                    .setTimestamp();
                
                // Send to dedicated channel if set, otherwise use current channel
                if (settings.leveling.levelUpChannel) {
                    const levelUpChannel = findChannel(message.guild, settings.leveling.levelUpChannel);
                    if (levelUpChannel) {
                        levelUpChannel.send({ embeds: [embed] });
                    } else {
                        message.channel.send({ embeds: [embed] });
                    }
                } else {
                    message.channel.send({ embeds: [embed] });
                }
            }
        }
    }
    
    // AI Chat in designated channel - Optimized
    if (settings.ai?.enabled && (message.channel.name === settings.ai.channelName || message.channel.id === settings.ai.channelId)) {
        if (message.author.bot || !config.deepseekApiKey || config.deepseekApiKey === 'YOUR_DEEPSEEK_API_KEY_HERE') return;
        
        const userId = message.author.id;
        const channelId = message.channel.id;
        const now = Date.now();
        
        // Cooldown check (3 seconds)
        if (aiCooldowns[userId] && now < aiCooldowns[userId] + 3000) {
            return message.reply(`⏱️ Wait ${((aiCooldowns[userId] + 3000 - now) / 1000).toFixed(1)}s before asking again.`);
        }
        
        // AI lockdown check
        if (isAILocked(message.guild.id)) {
            const lock = aiLockdown[message.guild.id];
            return message.reply(`🔒 **AI disabled.**\n**Reason:** ${lock.reason}\n**By:** ${lock.lockedByUsername}\n**Duration:** ${Math.floor((now - lock.timestamp) / 60000)}m\n\n*Only <@${config.botOwnerId}> can re-enable.*`);
        }
        
        // Content moderation (compacted)
        const lowercaseMsg = message.content.toLowerCase();
        if (/\b(n[i1]gg[ae]r|f[a4]gg[o0]t|ch[i1]nk|sp[i1]c|k[i1]ke|dyke|trann[yi]|wet\s*back|trump|biden|harris|election|democrat|republican|liberal|conservative|leftist|right\s*wing|left\s*wing|politics|political|ret[a4]rd|mongoloid|cripple|midget|kill\s*(yourself|himself|herself|themselves)|suicide|self\s*harm|terrorist|bomb\s*making)\b/i.test(lowercaseMsg)) {
            return message.reply('⚠️ I can\'t respond to that. Keep it respectful and avoid sensitive topics. Cheers! 🇬🇧');
        }
        
        // Jailbreak detection
        if (detectJailbreak(message.content)) {
            lockAI(message.guild.id, userId, message.author.username, 'Jailbreak attempt');
            client.users.fetch(config.botOwnerId).then(owner => {
                owner.send({ embeds: [new EmbedBuilder()
                    .setTitle('🚨 AI SECURITY ALERT - Jailbreak Detected')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'User', value: `${message.author.tag} (${userId})`, inline: true },
                        { name: 'Server', value: message.guild.name, inline: true },
                        { name: 'Channel', value: `#${message.channel.name}`, inline: true },
                        { name: 'Message', value: message.content.substring(0, 1000), inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Mention bot in server to unlock' })
                ]}).catch(console.error);
            }).catch(console.error);
            return message.reply('⚠️ **Manipulation attempt detected.** 🔒\n\nAI disabled. Owner notified.');
        }
        
        aiCooldowns[userId] = now;
        if (!aiConversations[channelId]) aiConversations[channelId] = [];
        
        // Analyze tone and add message
        const userTone = analyzeUserTone(message.content, userId);
        const toneInstruction = getPersonalityForTone(userTone, message.author.username);
        
        aiConversations[channelId].push({
            role: 'user',
            content: `[${message.author.username}]: ${message.content}`,
            userId,
            timestamp: now
        });
        
        // Trim history
        const maxMsgs = settings.ai.maxHistory * 2;
        if (aiConversations[channelId].length > maxMsgs) {
            aiConversations[channelId] = aiConversations[channelId].slice(-maxMsgs);
        }
        
        // Process AI (async, non-blocking)
        (async () => {
            try {
                // Search detection
                let searchContext = '';
                if (/\b(latest|recent|current|today|news|what's new|search|look up|find|202[45]|who is|what is|when is|ps5 pro|rumors?|release|price|specs?|review|vs|versus|better|best|guide|tutorial|how to|explain|definition|compare|alternative)\b/i.test(message.content)) {
                    const results = await searchWeb(message.content);
                    if (results?.length) {
                        searchContext = '\n\nSEARCH RESULTS:\n' + results.map((r, i) => `${i + 1}. ${r.title}\n${r.description}\n${r.url}`).join('\n\n') + '\n\nCite sources when relevant.';
                    }
                }
                
                // Build message array (strip metadata for token efficiency)
                const messages = [
                    { role: 'system', content: `${settings.ai.systemPrompt}\n\n${toneInstruction}${searchContext}` },
                    ...aiConversations[channelId].map(m => ({ role: m.role, content: m.content }))
                ];
                
                // Call DeepSeek API
                const deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
                const response = await generateText({
                    model: deepseek(settings.ai.model),
                    messages,
                    temperature: settings.ai.temperature,
                    maxTokens: 400
                });
                
                const text = response.text;
                const completionTokens = response.usage?.completionTokens || response.usage?.outputTokens || 'N/A';
                const totalTokens = response.usage?.totalTokens || 'N/A';

                // Log token usage
                console.log(`🤖 AI Response | Total: ${totalTokens} tokens (Completion: ${completionTokens}) | Words: ${text.split(' ').length}`);

                if (!text?.trim()) {
                    return message.reply('❌ Empty response received. Try again!');
                }

                // Safeguard: Truncate to 400 tokens (approximate, whitespace split)
                let safeText = text;
                const words = text.split(/\s+/);
                if (words.length > 400) {
                    safeText = words.slice(0, 400).join(' ') + '...';
                }

                // Add to history
                aiConversations[channelId].push({ role: 'assistant', content: safeText, timestamp: now });

                // Send response with completion token usage (chunk if needed)
                const tokenFooter = `\n\n*Response: ${completionTokens} tokens*`;
                if (safeText.length > 1900) {
                    const chunks = safeText.match(/[\s\S]{1,1900}/g) || [];
                    await message.reply(chunks[0]);
                    for (let i = 1; i < chunks.length - 1; i++) await message.channel.send(chunks[i]);
                    await message.channel.send(chunks[chunks.length - 1] + tokenFooter);
                } else {
                    await message.reply(safeText + tokenFooter);
                }
            } catch (err) {
                console.error('AI Error:', err);
                await message.reply(err.name === 'AbortError' ? '⏱️ Timeout. Try again!' : '❌ Error occurred. Try again!').catch(() => {});
            }
        })();
    }
    
    // PS3 Error Code Detection
    if (settings.keywords && settings.keywords.enabled) {
        await checkKeywords(message, settings);
    }
});


// Function to check for PS3 error codes (optimized with regex cache)
async function checkKeywords(message, settings) {
    try {
        const messageContent = message.content.toUpperCase();
        
        // Search directly in ps3ErrorCodes database with cached regex patterns
        let foundErrorCode = null;
        for (const code of errorCodeKeys) {
            // Check if message contains the error code (case-insensitive)
            if (messageContent.includes(code.toUpperCase())) {
                foundErrorCode = code;
                break; // Early exit on first match
            }
        }
        
        if (!foundErrorCode) return;
        
        // Log keyword flag
        await logEvent(message.guild, 'keywordFlag', {
            user: message.author.tag,
            userId: message.author.id,
            channelId: message.channel.id,
            keyword: foundErrorCode,
            content: message.content,
            messageUrl: message.url
        });
        
        // Get error description from database
        const errorDescription = ps3ErrorCodes[foundErrorCode];
        
        // Get pre-computed category (instant lookup)
        const categoryInfo = errorCodeCategories.get(foundErrorCode);
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`❓ Error Code: ${foundErrorCode}`)
            .setDescription(`\n\n🗨️ **${errorDescription}**\n\n\n**${categoryInfo.name}**`)
            .setColor(categoryInfo.color)
            .setTimestamp();
        
        await message.channel.send({ embeds: [errorEmbed] });
    } catch (error) {
        console.error('Error in checkKeywords:', error);
    }
}

// Member join event (Welcome message)
client.on('guildMemberAdd', async (member) => {
    const settings = getGuildSettings(member.guild.id);
    
    // Log member join
    await logEvent(member.guild, 'memberJoin', {
        user: member.user.tag,
        userId: member.id,
        avatarUrl: member.user.displayAvatarURL(),
        createdTimestamp: Math.floor(member.user.createdTimestamp / 1000),
        memberCount: member.guild.memberCount
    });
    
    // Raid protection - Track join
    if (settings.raidProtection?.enabled && !lockedServers.has(member.guild.id)) {
        const joins = joinTracker.get(member.guild.id) || [];
        joins.push({ userId: member.id, timestamp: Date.now() });
        joinTracker.set(member.guild.id, joins);
        
        // Check for raid
        await checkForRaid(member.guild);
    }
    
    // If server is in lockdown, handle the new join
    if (lockedServers.has(member.guild.id) && settings.raidProtection?.enabled) {
        // Skip whitelisted users and admins
        if (!settings.raidProtection.whitelist.includes(member.id) && 
            !member.permissions.has(PermissionFlagsBits.Administrator) &&
            member.id !== member.guild.ownerId) {
            
            try {
                if (settings.raidProtection.action === 'kick') {
                    await member.kick('Server in raid lockdown');
                    console.log(`⚠️ Kicked ${member.user.tag} (Lockdown mode)`);
                } else if (settings.raidProtection.action === 'ban') {
                    await member.ban({ reason: 'Server in raid lockdown', deleteMessageSeconds: 0 });
                    console.log(`🔨 Banned ${member.user.tag} (Lockdown mode)`);
                }
                return; // Don't send welcome message
            } catch (error) {
                console.error(`Error actioning user during lockdown:`, error);
            }
        }
    }
    
    // Auto-nickname feature
    if (settings.autoNickname?.enabled) {
        try {
            const prefix = settings.autoNickname.prefix || '';
            const suffix = settings.autoNickname.suffix || '';
            const currentName = member.user.username;
            let newNickname = `${prefix}${currentName}${suffix}`;
            
            // Discord nickname limit is 32 characters
            if (newNickname.length > 32) {
                newNickname = newNickname.substring(0, 32);
            }
            
            member.setNickname(newNickname).catch(err => {
                console.log(`Could not set nickname for ${member.user.tag}:`, err.message);
            });
        } catch (error) {
            console.error('Error setting auto-nickname:', error);
        }
    }
    
    // Welcome message
    if (!settings.welcome.enabled) return;
    
    const welcomeChannel = findChannel(member.guild, settings.welcome.channelName) 
        || findChannel(member.guild, 'general') 
        || findChannel(member.guild, 'welcome');
    
    if (welcomeChannel) {
        const description = settings.welcome.customMessage 
            ? settings.welcome.customMessage.replace('{user}', member.toString()).replace('{server}', member.guild.name).replace('{memberCount}', member.guild.memberCount.toString())
            : `Welcome ${member}! We're glad to have you here in the PSHomebrew community!`;
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('👋 Welcome to the Server!')
            .setDescription(description)
            .setColor(0x00FF00)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '📖 Getting Started', value: 'Check out our rules and guidelines', inline: false },
                { name: '🎮 PSHomebrew', value: 'Feel free to ask questions about PlayStation homebrew development', inline: false },
                { name: '👥 Community', value: `You are member #${member.guild.memberCount}`, inline: false }
            )
            .setFooter({ text: 'PSHomebrew Community' })
            .setTimestamp();
        
        welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
    initializeUser(member.user.id);
});

// Member leave event
client.on('guildMemberRemove', (member) => {
    const settings = getGuildSettings(member.guild.id);
    
    // Log member leave
    const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ') || 'None';
    logEvent(member.guild, 'memberLeave', {
        user: member.user.tag,
        userId: member.id,
        avatarUrl: member.user.displayAvatarURL(),
        joinedAt: member.joinedAt ? Math.floor(member.joinedTimestamp / 1000) : null,
        memberCount: member.guild.memberCount,
        roles: roles
    });
    
    if (!settings.leave.enabled) return;
    
    const leaveChannel = findChannel(member.guild, settings.leave.channelName) 
        || findChannel(member.guild, 'general') 
        || findChannel(member.guild, 'goodbye');
    
    if (leaveChannel) {
        const description = settings.leave.customMessage
            ? settings.leave.customMessage.replace('{user}', member.user.tag).replace('{server}', member.guild.name).replace('{memberCount}', member.guild.memberCount.toString())
            : `${member.user.tag} has left the server. We'll miss you!`;
        
        const leaveEmbed = new EmbedBuilder()
            .setTitle('👋 Goodbye!')
            .setDescription(description)
            .setColor(0xFF0000)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '📊 Member Count', value: member.guild.memberCount.toString(), inline: true },
                { name: '⏰ Time in Server', value: member.joinedAt ? `Joined ${member.joinedAt.toDateString()}` : 'Unknown', inline: true }
            )
            .setFooter({ text: 'PSHomebrew Community' })
            .setTimestamp();
        
        leaveChannel.send({ embeds: [leaveEmbed] });
    }
});

// Message delete event
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author?.bot) return;
    
    const attachments = message.attachments.size > 0 
        ? message.attachments.map(a => a.url).join('\n') 
        : null;
    
    await logEvent(message.guild, 'messageDelete', {
        author: message.author?.tag || 'Unknown User',
        authorId: message.author?.id || 'Unknown',
        channelId: message.channel.id,
        content: message.content || '*No text content*',
        attachments: attachments
    });
});

// Message edit event
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embed updates
    
    await logEvent(newMessage.guild, 'messageEdit', {
        author: newMessage.author.tag,
        authorId: newMessage.author.id,
        channelId: newMessage.channel.id,
        oldContent: oldMessage.content || '*No content*',
        newContent: newMessage.content || '*No content*',
        messageUrl: newMessage.url
    });
});

// Voice state update event
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.guild) return;
    
    // User joined a voice channel
    if (!oldState.channel && newState.channel) {
        await logEvent(newState.guild, 'voiceJoin', {
            user: newState.member.user.tag,
            userId: newState.member.id,
            channelId: newState.channel.id
        });
    }
    
    // User left a voice channel
    if (oldState.channel && !newState.channel) {
        await logEvent(oldState.guild, 'voiceLeave', {
            user: oldState.member.user.tag,
            userId: oldState.member.id,
            channelId: oldState.channel.id
        });
    }
});

// Channel create event
client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    
    const typeMap = {
        0: 'Text Channel',
        2: 'Voice Channel',
        4: 'Category',
        5: 'Announcement Channel',
        13: 'Stage Channel',
        15: 'Forum Channel'
    };
    
    await logEvent(channel.guild, 'channelCreate', {
        channelId: channel.id,
        type: typeMap[channel.type] || 'Unknown'
    });
});

// Channel delete event
client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    
    const typeMap = {
        0: 'Text Channel',
        2: 'Voice Channel',
        4: 'Category',
        5: 'Announcement Channel',
        13: 'Stage Channel',
        15: 'Forum Channel'
    };
    
    await logEvent(channel.guild, 'channelDelete', {
        channelName: channel.name,
        type: typeMap[channel.type] || 'Unknown'
    });
});

// Role update event (member role changes)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    
    if (addedRoles.size === 0 && removedRoles.size === 0) return;
    
    const data = {
        user: newMember.user.tag,
        action: addedRoles.size > 0 && removedRoles.size > 0 ? 'Roles Updated' : 
                addedRoles.size > 0 ? 'Roles Added' : 'Roles Removed'
    };
    
    if (addedRoles.size > 0) {
        data.added = addedRoles.map(r => r.name).join(', ');
    }
    if (removedRoles.size > 0) {
        data.removed = removedRoles.map(r => r.name).join(', ');
    }
    
    await logEvent(newMember.guild, 'roleChange', data);
});

// Unified interaction handler (slash commands, buttons, select menus)
client.on('interactionCreate', async (interaction) => {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            // Verify bot has necessary permissions
            if (interaction.guild && interaction.guild.members.me && !interaction.guild.members.me.permissions.has(PermissionFlagsBits.SendMessages)) {
                console.error(`Missing SendMessages permission in guild: ${interaction.guild.name}`);
                return;
            }
        
    // Help command - Command list
    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 PSHomebrew Bot - Commands')
            .setDescription('Here are all available commands:')
            .setColor(0x0066CC)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '📊 Leveling Commands',
                    value: '`/level` - Check your level and XP\n`/level @user` - Check another user\'s level\n`/rank` - See your rank position\n`/leaderboard` - View top 10 users',
                    inline: false
                },
                {
                    name: 'ℹ️ Information',
                    value: '`/help` - Show this command list\n`/ping` - Check bot latency\n`/features` - View all bot features\n`/viewsettings` - View server settings (Admin)',
                    inline: false
                },
                {
                    name: '⚙️ Admin - Toggle Features',
                    value: '`/toggle` - Toggle features on/off',
                    inline: false
                },
                {
                    name: '⚙️ Admin - Leveling Settings',
                    value: '`/setxp` - Set XP range per message\n`/setcooldown` - Set XP cooldown\n`/setmaxlevel` - Set maximum level\n`/setlevelupchannel` - Set level up announcement channel',
                    inline: false
                },
                {
                    name: '⚙️ Admin - Welcome/Leave Settings',
                    value: '`/setwelcomechannel` - Set welcome channel\n`/setleavechannel` - Set leave channel\n`/setwelcomemessage` - Set custom welcome message\n`/setleavemessage` - Set custom leave message\n`/resetmessages` - Reset to default messages',
                    inline: false
                },
                {
                    name: '⚙️ Admin - PS3 Error Code Settings',
                    value: '`/addkeyword` - Add an error code\n`/removekeyword` - Remove an error code\n`/listkeywords` - List all error codes\n`/setkeywordresponse` - Set custom response',
                    inline: false
                },
                {
                    name: '🎮 PS3 Error Code Detection',
                    value: `Simply type any PS3 error code in chat (e.g., \`80710016\`) and get instant troubleshooting help!\n**${Object.keys(ps3ErrorCodes).length} error codes** in database`,
                    inline: false
                }
            )
            .setFooter({ text: 'PSHomebrew Community Bot â€¢ Use /features for more info' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [helpEmbed] });
    }
    
    // Ping command - Check bot latency
    if (interaction.commandName === 'ping') {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true, ephemeral: true });
        const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const wsLatency = client.ws.ping;
        
        const pingEmbed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor(wsLatency < 100 ? 0x00FF00 : wsLatency < 200 ? 0xFFFF00 : 0xFF0000)
            .addFields(
                {
                    name: '📡 Roundtrip Latency',
                    value: `\`${roundtripLatency}ms\``,
                    inline: true
                },
                {
                    name: '💓 WebSocket Heartbeat',
                    value: `\`${wsLatency}ms\``,
                    inline: true
                },
                {
                    name: '📊 Status',
                    value: wsLatency < 100 ? '🟢 Excellent' : wsLatency < 200 ? '🟡 Good' : '🔴 High',
                    inline: true
                }
            )
            .setTimestamp();
        
        await interaction.editReply({ content: '', embeds: [pingEmbed] });
    }
    
    // Shutdown command (Bot Owner only)
    if (interaction.commandName === 'shutdown') {
        // Check if user is bot owner
        if (interaction.user.id !== config.botOwnerId) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command!', ephemeral: true });
        }
        
        const shutdownEmbed = new EmbedBuilder()
            .setTitle('🔴 Bot Shutting Down')
            .setDescription('Initiating graceful shutdown sequence...\n\n✅ Sending offline notifications\n⏳ Saving all data\n👋 Goodbye!')
            .setColor(0xFF0000)
            .setTimestamp();
        
        await interaction.reply({ embeds: [shutdownEmbed] });
        
        // Give Discord time to send the reply, then initiate shutdown
        setTimeout(() => {
            gracefulShutdown('Discord /shutdown command');
        }, 1000);
    }
    
    // View Settings command
    if (interaction.commandName === 'viewsettings') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        
        const settingsEmbed = new EmbedBuilder()
            .setTitle('⚙️ Server Settings')
            .setDescription(`Current configuration for **${interaction.guild.name}**`)
            .setColor(0xFFAA00)
            .addFields(
                {
                    name: '📊 Leveling System',
                    value: `**Status:** ${settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled'}\n**XP Range:** ${settings.leveling.minXP}-${settings.leveling.maxXP}\n**Cooldown:** ${settings.leveling.cooldown / 1000}s\n**Max Level:** ${settings.leveling.maxLevel}\n**Level Up Messages:** ${settings.leveling.showLevelUpMessages ? '✅' : '❌'}\n**Level Up Channel:** ${settings.leveling.levelUpChannel ? `#${settings.leveling.levelUpChannel}` : 'Current channel'}`,
                    inline: false
                },
                {
                    name: '🎮 PS3 Error Code Detection',
                    value: `**Status:** ${settings.keywords.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Error Codes:** ${Object.keys(ps3ErrorCodes).length} configured\n**Custom Response:** ${settings.keywords.customResponse ? '✅ Set' : '❌ Not set'}`,
                    inline: false
                },
                {
                    name: '👋 Welcome System',
                    value: `**Status:** ${settings.welcome.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** #${settings.welcome.channelName}\n**Custom Message:** ${settings.welcome.customMessage ? '✅ Set' : '❌ Not set'}`,
                    inline: false
                },
                {
                    name: '👋 Leave System',
                    value: `**Status:** ${settings.leave.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** #${settings.leave.channelName}\n**Custom Message:** ${settings.leave.customMessage ? '✅ Set' : '❌ Not set'}`,
                    inline: false
                }
            )
            .setFooter({ text: 'Use buttons below to toggle features' })
            .setTimestamp();
        
        // Create buttons for each feature
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_leveling')
                    .setLabel(settings.leveling.enabled ? '📊 Disable Leveling' : '📊 Enable Leveling')
                    .setStyle(settings.leveling.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('toggle_keywords')
                    .setLabel(settings.keywords.enabled ? '🎮 Disable PS3 Errors' : '🎮 Enable PS3 Errors')
                    .setStyle(settings.keywords.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_welcome')
                    .setLabel(settings.welcome.enabled ? '👋 Disable Welcome' : '👋 Enable Welcome')
                    .setStyle(settings.welcome.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('toggle_leave')
                    .setLabel(settings.leave.enabled ? '🚪 Disable Leave' : '🚪 Enable Leave')
                    .setStyle(settings.leave.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            );
        
        await interaction.reply({ embeds: [settingsEmbed], components: [row1, row2], ephemeral: true });
    }
    
    // Features command - Detailed feature information
    if (interaction.commandName === 'features') {
        const settings = getGuildSettings(interaction.guild.id);
        
        const featuresEmbed = new EmbedBuilder()
            .setTitle('🌟 PSHomebrew Bot - Features')
            .setDescription('Welcome to the PSHomebrew Discord Bot! Here\'s everything this bot can do:')
            .setColor(0x00FF88)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: `⭐ Leveling System (${settings.leveling.enabled ? '✅ Enabled' : 'âŒ Disabled'})`,
                    value: `â€¢ Earn **${settings.leveling.minXP}-${settings.leveling.maxXP} XP** per message\nâ€¢ **${settings.leveling.cooldown / 1000}s cooldown** between XP gains\nâ€¢ **${settings.leveling.maxLevel} levels** total\nâ€¢ Level up notifications ${settings.leveling.showLevelUpMessages ? 'enabled' : 'disabled'}`,
                    inline: false
                },
                {
                    name: `🎮 PS3 Error Code Detection (${settings.keywords.enabled ? '✅ Enabled' : '❌ Disabled'})`,
                    value: `Automatically detects and explains **${Object.keys(ps3ErrorCodes).length} PS3 error codes**\nSimply type an error code (e.g., 80710016) and get instant troubleshooting help!`,
                    inline: false
                },
                {
                    name: `👋 Welcome Messages (${settings.welcome.enabled ? '✅ Enabled' : '❌ Disabled'})`,
                    value: `Channel: #${settings.welcome.channelName}${settings.welcome.customMessage ? '\n📝 Custom message set' : ''}`,
                    inline: false
                },
                {
                    name: `👋 Leave Messages (${settings.leave.enabled ? '✅ Enabled' : '❌ Disabled'})`,
                    value: `Channel: #${settings.leave.channelName}${settings.leave.customMessage ? '\n📝 Custom message set' : ''}`,
                    inline: false
                },
                {
                    name: '⚙️ Customize Features',
                    value: 'Admins can use individual commands to customize features!\nUse `/viewsettings` to see all current settings.',
                    inline: false
                }
            )
            .setFooter({ text: 'PSHomebrew Community Bot â€¢ Use /help for commands' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [featuresEmbed] });
    }
    
    // Toggle command
    if (interaction.commandName === 'toggle') {
        if (!requireAdmin(interaction)) return;
        
        const feature = interaction.options.getString('feature');
        const settings = getGuildSettings(interaction.guild.id);
        
        if (feature === 'leveling') {
            settings.leveling.enabled = !settings.leveling.enabled;
            saveSettings();
            await interaction.reply({ content: `✅ Leveling system ${settings.leveling.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
        } else if (feature === 'levelup_messages') {
            settings.leveling.showLevelUpMessages = !settings.leveling.showLevelUpMessages;
            saveSettings();
            await interaction.reply({ content: `✅ Level up messages ${settings.leveling.showLevelUpMessages ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
        } else if (feature === 'welcome') {
            settings.welcome.enabled = !settings.welcome.enabled;
            saveSettings();
            await interaction.reply({ content: `✅ Welcome messages ${settings.welcome.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
        } else if (feature === 'leave') {
            settings.leave.enabled = !settings.leave.enabled;
            saveSettings();
            await interaction.reply({ content: `✅ Leave messages ${settings.leave.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
        } else if (feature === 'keywords') {
            settings.keywords.enabled = !settings.keywords.enabled;
            saveSettings();
            await interaction.reply({ content: `✅ Keyword detection ${settings.keywords.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
        }
    }
    
    // Set XP command
    if (interaction.commandName === 'setxp') {
        if (!requireAdmin(interaction)) return;
        
        const min = interaction.options.getInteger('min');
        const max = interaction.options.getInteger('max');
        
        if (min > max) {
            return interaction.reply({ content: 'âŒ Min XP cannot be greater than Max XP!', ephemeral: true });
        }
        
        const settings = getGuildSettings(interaction.guild.id);
        settings.leveling.minXP = min;
        settings.leveling.maxXP = max;
        saveSettings();
        
        await interaction.reply({ content: `✅ XP range set to **${min}-${max}** per message!`, ephemeral: true });
    }
    
    // Set Cooldown command
    if (interaction.commandName === 'setcooldown') {
        if (!requireAdmin(interaction)) return;
        
        const seconds = interaction.options.getInteger('seconds');
        const settings = getGuildSettings(interaction.guild.id);
        settings.leveling.cooldown = seconds * 1000;
        saveSettings();
        
        await interaction.reply({ content: `✅ XP cooldown set to **${seconds} seconds**!`, ephemeral: true });
    }
    
    // Set Max Level command
    if (interaction.commandName === 'setmaxlevel') {
        if (!requireAdmin(interaction)) return;
        
        const level = interaction.options.getInteger('level');
        
        if (level < 1 || level > 1000) {
            return interaction.reply({ content: 'âŒ Max level must be between 1 and 1000!', ephemeral: true });
        }
        
        const settings = getGuildSettings(interaction.guild.id);
        settings.leveling.maxLevel = level;
        saveSettings();
        
        await interaction.reply({ content: `✅ Max level set to **${level}**!`, ephemeral: true });
    }
    
    // Set Level Role command
    if (interaction.commandName === 'setlevelrole') {
        if (!requireAdmin(interaction)) return;
        
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.leveling.levelRoles) {
            settings.leveling.levelRoles = {};
        }
        
        settings.leveling.levelRoles[level] = role.id;
        saveSettings();
        
        await interaction.reply({ content: `✅ Level **${level}** now grants the role ${role}!`, ephemeral: true });
    }
    
    // Remove Level Role command
    if (interaction.commandName === 'removelevelrole') {
        if (!requireAdmin(interaction)) return;
        
        const level = interaction.options.getInteger('level');
        
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.leveling.levelRoles || !settings.leveling.levelRoles[level]) {
            return interaction.reply({ content: `❌ No role is set for level **${level}**!`, ephemeral: true });
        }
        
        delete settings.leveling.levelRoles[level];
        saveSettings();
        
        await interaction.reply({ content: `✅ Removed role for level **${level}**!`, ephemeral: true });
    }
    
    // Set Level Up Channel command
    if (interaction.commandName === 'setlevelupchannel') {
        if (!requireAdmin(interaction)) return;
        
        const channel = interaction.options.getString('channel');
        const settings = getGuildSettings(interaction.guild.id);
        
        if (channel) {
            settings.leveling.levelUpChannel = channel;
            saveSettings();
            await interaction.reply({ content: `✅ Level up messages will now be sent to **#${channel}**!`, ephemeral: true });
        } else {
            settings.leveling.levelUpChannel = null;
            saveSettings();
            await interaction.reply({ content: `✅ Level up messages will now appear in the **current channel** where users chat!`, ephemeral: true });
        }
    }
    
    // Set Welcome Channel command
    if (interaction.commandName === 'setwelcomechannel') {
        if (!requireAdmin(interaction)) return;
        
        const channel = interaction.options.getString('channel');
        const settings = getGuildSettings(interaction.guild.id);
        settings.welcome.channelName = channel;
        saveSettings();
        
        await interaction.reply({ content: `✅ Welcome channel set to **#${channel}**!`, ephemeral: true });
    }
    
    // Set Leave Channel command
    if (interaction.commandName === 'setleavechannel') {
        if (!requireAdmin(interaction)) return;
        
        const channel = interaction.options.getString('channel');
        const settings = getGuildSettings(interaction.guild.id);
        settings.leave.channelName = channel;
        saveSettings();
        
        await interaction.reply({ content: `✅ Leave channel set to **#${channel}**!`, ephemeral: true });
    }
    
    // Set Welcome Message command
    if (interaction.commandName === 'setwelcomemessage') {
        if (!requireAdmin(interaction)) return;
        
        const message = interaction.options.getString('message');
        const settings = getGuildSettings(interaction.guild.id);
        settings.welcome.customMessage = message;
        saveSettings();
        
        await interaction.reply({ content: `✅ Custom welcome message set!\n**Placeholders:** {user}, {server}, {memberCount}`, ephemeral: true });
    }
    
    // Set Leave Message command
    if (interaction.commandName === 'setleavemessage') {
        if (!requireAdmin(interaction)) return;
        
        const message = interaction.options.getString('message');
        const settings = getGuildSettings(interaction.guild.id);
        settings.leave.customMessage = message;
        saveSettings();
        
        await interaction.reply({ content: `✅ Custom leave message set!\n**Placeholders:** {user}, {server}, {memberCount}`, ephemeral: true });
    }
    
    // Add Keyword command
    if (interaction.commandName === 'addkeyword') {
        if (!requireAdmin(interaction)) return;
        
        const keyword = interaction.options.getString('keyword');
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.keywords.list.includes(keyword.toLowerCase())) {
            settings.keywords.list.push(keyword.toLowerCase());
            saveSettings();
            await interaction.reply({ content: `✅ Added keyword: **"${keyword}"**`, ephemeral: true });
        } else {
            await interaction.reply({ content: `âŒ Keyword **"${keyword}"** already exists!`, ephemeral: true });
        }
    }
    
    // Remove Keyword command
    if (interaction.commandName === 'removekeyword') {
        if (!requireAdmin(interaction)) return;
        
        const keyword = interaction.options.getString('keyword');
        const settings = getGuildSettings(interaction.guild.id);
        const index = settings.keywords.list.indexOf(keyword.toLowerCase());
        
        if (index > -1) {
            settings.keywords.list.splice(index, 1);
            saveSettings();
            await interaction.reply({ content: `✅ Removed keyword: **"${keyword}"**`, ephemeral: true });
        } else {
            await interaction.reply({ content: `âŒ Keyword **"${keyword}"** not found!`, ephemeral: true });
        }
    }
    
    // List Keywords command (now shows PS3 Error Codes)
    if (interaction.commandName === 'listkeywords') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        
        // Show first 20 error codes as preview
        const previewCodes = settings.keywords.list.slice(0, 20);
        const keywordList = previewCodes.map(code => `\`${code}\` - ${ps3ErrorCodes[code]?.substring(0, 50) || 'Unknown'}...`).join('\n');
        
        const listEmbed = new EmbedBuilder()
            .setTitle('📝 PS3 Error Codes Database')
            .setDescription(`**Total Error Codes:** ${settings.keywords.list.length}\n\n**Sample Codes:**\n${keywordList}\n\n*...and ${settings.keywords.list.length - 20} more*`)
            .setColor(0x0099FF)
            .setFooter({ text: 'Type any error code in chat for full details' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [listEmbed], ephemeral: true });
    }
    
    // Set Keyword Response command
    if (interaction.commandName === 'setkeywordresponse') {
        if (!requireAdmin(interaction)) return;
        
        const response = interaction.options.getString('response');
        const settings = getGuildSettings(interaction.guild.id);
        settings.keywords.customResponse = response;
        saveSettings();
        
        await interaction.reply({ content: `✅ Custom keyword response set!`, ephemeral: true });
    }
    
    // Reset Messages command
    if (interaction.commandName === 'resetmessages') {
        if (!requireAdmin(interaction)) return;
        
        const type = interaction.options.getString('type');
        const settings = getGuildSettings(interaction.guild.id);
        
        if (type === 'welcome') {
            settings.welcome.customMessage = null;
            saveSettings();
            await interaction.reply({ content: `✅ Welcome message reset to default!`, ephemeral: true });
        }
        else if (type === 'leave') {
            settings.leave.customMessage = null;
            saveSettings();
            await interaction.reply({ content: `✅ Leave message reset to default!`, ephemeral: true });
        }
        else if (type === 'keyword') {
            settings.keywords.customResponse = null;
            saveSettings();
            await interaction.reply({ content: `✅ Keyword response reset to default!`, ephemeral: true });
        }
    }
    
    // Server Stats Setup command - Interactive Panel
    if (interaction.commandName === 'serverstatsssetup') {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This command can only be used in a server!', ephemeral: true });
        }
        
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.serverStats) {
            settings.serverStats = defaultSettings.serverStats;
        }
        
        // Clean up deleted channels before showing the panel
        let channelsCleanedUp = false;
        if (settings.serverStats.channels.memberCount) {
            const memberChannel = interaction.guild.channels.cache.get(settings.serverStats.channels.memberCount);
            if (!memberChannel) {
                settings.serverStats.channels.memberCount = null;
                channelsCleanedUp = true;
            }
        }
        if (settings.serverStats.channels.botCount) {
            const botChannel = interaction.guild.channels.cache.get(settings.serverStats.channels.botCount);
            if (!botChannel) {
                settings.serverStats.channels.botCount = null;
                channelsCleanedUp = true;
            }
        }
        if (settings.serverStats.channels.totalCount) {
            const totalChannel = interaction.guild.channels.cache.get(settings.serverStats.channels.totalCount);
            if (!totalChannel) {
                settings.serverStats.channels.totalCount = null;
                channelsCleanedUp = true;
            }
        }
        if (settings.serverStats.channels.statusChannel) {
            const statusChannel = interaction.guild.channels.cache.get(settings.serverStats.channels.statusChannel);
            if (!statusChannel) {
                settings.serverStats.channels.statusChannel = null;
                channelsCleanedUp = true;
            }
        }
        
        // Save if any channels were cleaned up
        if (channelsCleanedUp) {
            saveSettings();
        }
        
        const embed = new EmbedBuilder()
            .setTitle('📊 Server Stats Settings')
            .setDescription('Manage your server statistics tracking system')
            .setColor(settings.serverStats.enabled ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: '📡 Status', value: settings.serverStats.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '⏱️ Update Interval', value: `${settings.serverStats.updateInterval / 60000} minute(s)`, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: '👥 Member Count Channel', value: settings.serverStats.channels.memberCount ? `<#${settings.serverStats.channels.memberCount}>` : '❌ Not set', inline: false },
                { name: '🤖 Bot Count Channel', value: settings.serverStats.channels.botCount ? `<#${settings.serverStats.channels.botCount}>` : '❌ Not set', inline: false },
                { name: '📊 Total Count Channel', value: settings.serverStats.channels.totalCount ? `<#${settings.serverStats.channels.totalCount}>` : '❌ Not set', inline: false },
                { name: '🟢 Bot Status Channel', value: settings.serverStats.channels.statusChannel ? `<#${settings.serverStats.channels.statusChannel}>` : '❌ Not set', inline: false }
            )
            .setFooter({ text: 'Use the buttons below to manage server stats' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stats_toggle')
                    .setLabel(settings.serverStats.enabled ? 'Disable Stats' : 'Enable Stats')
                    .setStyle(settings.serverStats.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(settings.serverStats.enabled ? '🔴' : '✅'),
                new ButtonBuilder()
                    .setCustomId('stats_setup')
                    .setLabel('Setup Channels')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔧')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stats_interval')
                    .setLabel('Set Interval')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('stats_refresh')
                    .setLabel('Refresh Now')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
                    .setDisabled(!settings.serverStats.enabled || !settings.serverStats.channels.memberCount)
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }
    
    // Level command
    if (interaction.commandName === 'level') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        
        initializeUser(userId);
        const progress = getXPProgress(userData[userId].xp);
        
        const levelEmbed = new EmbedBuilder()
            .setTitle(`📊 Level Stats for ${targetUser.tag}`)
            .setDescription(`**Level ${progress.level}** • ${progress.totalXP.toLocaleString()} Total XP`)
            .setColor(0x0099FF)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: '🎯 Current Level', value: progress.level.toString(), inline: true },
                { name: '⭐ Total XP', value: progress.totalXP.toLocaleString(), inline: true },
                { name: '📈 Progress', value: `${progress.currentLevelXP}/${progress.xpRequiredForCurrentLevel} XP`, inline: true }
            )
            .setFooter({ text: 'PSHomebrew Leveling System â€¢ Use /help for more info' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [levelEmbed] });
    }
    
    // Rank command
    if (interaction.commandName === 'rank') {
        const userId = interaction.user.id;
        initializeUser(userId);
        
        const sortedUsers = Object.entries(userData)
            .sort(([,a], [,b]) => b.xp - a.xp);
        
        const userRank = sortedUsers.findIndex(([id]) => id === userId) + 1;
        const progress = getXPProgress(userData[userId].xp);
        
        const rankEmbed = new EmbedBuilder()
            .setTitle(`🏅 Rank Information for ${interaction.user.tag}`)
            .setDescription(`You are ranked **#${userRank}** out of **${sortedUsers.length}** members!`)
            .setColor(0xFF6B00)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { name: '🏆 Your Rank', value: `#${userRank}`, inline: true },
                { name: '🎯 Your Level', value: progress.level.toString(), inline: true },
                { name: '⭐ Total XP', value: progress.totalXP.toLocaleString(), inline: true },
                { name: '📊 Progress to Next Level', value: `${progress.currentLevelXP}/${progress.xpRequiredForCurrentLevel} XP`, inline: false }
            )
            .setFooter({ text: 'PSHomebrew Leveling System â€¢ Keep chatting to rank up!' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [rankEmbed] });
    }
    
    // AI Chat command
    if (interaction.commandName === 'aichat') {
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.ai) {
            settings.ai = defaultSettings.ai;
        }
        
        if (!settings.ai.enabled) {
            return interaction.reply({ content: '❌ AI chat is disabled on this server. Ask an admin to enable it!', ephemeral: true });
        }
        
        if (!config.deepseekApiKey || config.deepseekApiKey === 'YOUR_DEEPSEEK_API_KEY_HERE') {
            return interaction.reply({ content: '❌ DeepSeek API key is not configured! Please add it to config.json', ephemeral: true });
        }
        
        // Check if AI is locked in this guild
        if (isAILocked(interaction.guild.id)) {
            const lockInfo = aiLockdown[interaction.guild.id];
            const now = Date.now();
            const timeLocked = Math.floor((now - lockInfo.timestamp) / 1000 / 60); // minutes
            return interaction.reply({ 
                content: `🔒 **AI is currently disabled.**\n**Reason:** ${lockInfo.reason}\n**Locked by:** ${lockInfo.lockedByUsername}\n**Time locked:** ${timeLocked} minutes ago\n\n*Only <@${config.botOwnerId}> can re-enable it by mentioning me.*`,
                ephemeral: true 
            });
        }
        
        const userMessage = interaction.options.getString('message');
        const channelId = interaction.channel.id;
        const userId = interaction.user.id;
        
        // Jailbreak detection
        if (detectJailbreak(userMessage)) {
            lockAI(interaction.guild.id, userId, interaction.user.username, 'Jailbreak attempt detected');
            
            // Notify bot owner
            try {
                const owner = await client.users.fetch(config.botOwnerId);
                const alertEmbed = new EmbedBuilder()
                    .setTitle('🚨 AI SECURITY ALERT - Jailbreak Detected')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                        { name: 'Server', value: interaction.guild.name, inline: true },
                        { name: 'Channel', value: `#${interaction.channel.name}`, inline: true },
                        { name: 'Command', value: `/aichat`, inline: true },
                        { name: 'Message', value: userMessage.substring(0, 1000), inline: false },
                        { name: 'Action Taken', value: '🔒 AI locked in this server until you re-enable it', inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Mention the bot in the server to unlock AI' });
                
                await owner.send({ embeds: [alertEmbed] });
            } catch (error) {
                console.error('Failed to notify owner of jailbreak attempt:', error);
            }
            
            return interaction.reply({ 
                content: '⚠️ **That message appears to be an attempt to manipulate my system.** 🔒\n\nFor security reasons, AI chat has been disabled on this server. The bot owner has been notified.',
                ephemeral: true 
            });
        }
        
        // Analyze user's conversation tone
        const userTone = analyzeUserTone(userMessage, userId);
        const toneInstruction = getPersonalityForTone(userTone, interaction.user.username);
        
        // Initialize conversation history for this channel
        if (!aiConversations[channelId]) {
            aiConversations[channelId] = [];
        }
        
        // Add user message to history with userId for context
        aiConversations[channelId].push({
            role: 'user',
            content: `[${interaction.user.username}]: ${userMessage}`,
            userId: userId,
            timestamp: Date.now()
        });
        
        // Keep only last N messages based on maxHistory
        const maxMessages = settings.ai.maxHistory * 2; // *2 because each exchange has user + assistant
        if (aiConversations[channelId].length > maxMessages) {
            aiConversations[channelId] = aiConversations[channelId].slice(-maxMessages);
        }
        
        await interaction.deferReply();
        
        try {
            // Smart search detection (optimized regex)
            const needsSearch = /\b(latest|recent|current|today|news|what's new|search for|look up|find|2024|2025|who is|what is|where is|when is|how is|ps5 pro|playstation 5 pro|rumors?|rumours?|release|announced|available|came out|launch|price|cost|how much|specs?|specifications?|features?|review|comparison|vs\.?|versus|better than|best|top|ranking|chart|list of|guide|tutorial|how to|step by step|instructions?|explain|definition|meaning of|what does|what are|what's the difference|compare|versus|vs|alternative|option|choice)\b/i.test(userMessage);
            
            let searchContext = '';
            if (needsSearch) {
                const searchResults = await searchWeb(userMessage);
                if (searchResults && searchResults.length > 0) {
                    searchContext = '\n\nSEARCH RESULTS:\n' +
                        searchResults.map((r, i) => 
                            `${i + 1}. ${r.title}\n${r.description}\n${r.url}`
                        ).join('\n\n') +
                        '\n\nUse these search results to answer. Cite sources when relevant.';
                }
            }
            
            // Build optimized message array
            const messages = [
                {
                    role: 'system',
                    content: `${settings.ai.systemPrompt}\n\n${toneInstruction}${searchContext}`
                },
                // Only send content, not metadata (saves tokens)
                ...aiConversations[channelId].map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];
            
            // Use @ai-sdk/deepseek for DeepSeek API
            const deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
            let aiResponse = '';
            
            try {
                const completion = await deepseek.chat.completions.create({
                    model: settings.ai.model,
                    messages: messages,
                    temperature: settings.ai.temperature,
                    max_tokens: 400
                });
                
                aiResponse = completion.choices[0]?.message?.content;
                
                // Check if response is valid
                if (!aiResponse || aiResponse.trim().length === 0) {
                    console.error('DeepSeek returned empty response');
                    await interaction.editReply('❌ Sorry, I encountered an issue generating a response. Please try again!');
                    return;
                }
            } catch (err) {
                console.error('DeepSeek API Error:', err);
                await interaction.editReply('❌ Sorry, I\'m having trouble connecting to my AI brain. Please try again in a moment!');
                return;
            }
            
            // Add AI response to history
            aiConversations[channelId].push({
                role: 'assistant',
                content: aiResponse,
                timestamp: Date.now()
            });
            
            // Send response (optimized chunking)
            if (aiResponse.length > 1900) {
                const chunks = aiResponse.match(/[\s\S]{1,1900}/g) || [];
                await interaction.editReply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    await interaction.followUp(chunks[i]);
                }
            } else {
                await interaction.editReply(aiResponse);
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('AI request timeout');
                await interaction.editReply('⏱️ Request timed out. Please try again!');
            } else {
                console.error('AI Chat Error:', error);
                await interaction.editReply(`❌ An error occurred. Please try again!`);
            }
        }
    }
    
    // AI Clear command
    if (interaction.commandName === 'aiclear') {
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.ai || !settings.ai.enabled) {
            return interaction.reply({ content: '❌ AI chat is disabled on this server.', ephemeral: true });
        }
        
        const channelId = interaction.channel.id;
        
        if (aiConversations[channelId]) {
            delete aiConversations[channelId];
            await interaction.reply({ content: '✅ AI conversation history cleared for this channel!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'ℹ️ No conversation history to clear in this channel.', ephemeral: true });
        }
    }
    
    // AI Setup command - Interactive Panel
    if (interaction.commandName === 'aisetup') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.ai) {
            settings.ai = defaultSettings.ai;
        }
        
        const config = settings.ai;
        
        // Create interactive panel
        const embed = new EmbedBuilder()
            .setTitle('🤖 AI Chat System Control Panel')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `AI responds automatically to all messages in the designated channel using **${config.model}**.\n\n` +
                `Click the buttons below to configure AI settings.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '💬 Channel', value: `#${config.channelName}`, inline: true },
                { name: '🤖 Model', value: config.model, inline: true },
                { name: '🧠 Max History', value: `${config.maxHistory} exchanges`, inline: true },
                { name: '🌡️ Temperature', value: config.temperature.toString(), inline: true },
                { name: '📝 System Prompt', value: config.systemPrompt.substring(0, 100) + '...', inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure AI chat settings' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ai_toggle')
                    .setLabel(config.enabled ? 'Disable AI' : 'Enable AI')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('ai_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('ai_set_history')
                    .setLabel('Max History')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🧠'),
                new ButtonBuilder()
                    .setCustomId('ai_set_temperature')
                    .setLabel('Temperature')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🌡️')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ai_clear_history')
                    .setLabel('Clear All History')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('ai_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }
    
    // Leaderboard command (optimized to reduce API calls)
    if (interaction.commandName === 'leaderboard') {
        const sortedUsers = Object.entries(userData)
            .sort(([,a], [,b]) => b.xp - a.xp)
            .slice(0, 10);
        
        // Batch fetch users to reduce API calls
        const userPromises = sortedUsers.map(([userId]) => 
            client.users.fetch(userId).catch(() => null)
        );
        const users = await Promise.all(userPromises);
        
        let leaderboardText = '';
        for (let i = 0; i < sortedUsers.length; i++) {
            const [userId, data] = sortedUsers[i];
            const user = users[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const username = user ? user.tag : 'Unknown User';
            leaderboardText += `${medal} **${username}** - Level ${data.level} (${data.xp.toLocaleString()} XP)\n`;
        }
        
        const leaderboardEmbed = new EmbedBuilder()
            .setTitle('🏆 XP Leaderboard - Top 10')
            .setDescription(leaderboardText || 'No users found')
            .setColor(0xFFD700)
            .setFooter({ text: 'PSHomebrew Leveling System â€¢ Use /rank to see your position' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [leaderboardEmbed] });
    }
    
    // Welcome command - Interactive Panel
    if (interaction.commandName === 'welcome') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        const config = settings.welcome;
        
        const messagePreview = (config.customMessage || 'Welcome {user} to {server}! You are member #{memberCount}!')
            .substring(0, 200);
        
        const embed = new EmbedBuilder()
            .setTitle('👋 Welcome System Control Panel')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Automatically welcome new members with custom messages.\n\n` +
                `Click the buttons below to configure settings.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '💬 Channel', value: `#${config.channelName || 'Not set'}`, inline: true },
                { name: '📝 Custom Message', value: config.customMessage ? '✅ Set' : '❌ Using default', inline: true },
                { name: '💭 Message Preview', value: messagePreview, inline: false },
                { name: '🔖 Placeholders', value: '`{user}` `{server}` `{memberCount}`', inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure welcome messages' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('welcome_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('welcome_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('welcome_set_message')
                    .setLabel('Set Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('welcome_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
    }
    
    // Leaving command - Interactive Panel
    if (interaction.commandName === 'leaving') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        const config = settings.leave;
        
        const messagePreview = (config.customMessage || '{user} has left {server}. We now have {memberCount} members.')
            .substring(0, 200);
        
        const embed = new EmbedBuilder()
            .setTitle('👋 Leave System Control Panel')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Automatically announce when members leave the server.\n\n` +
                `Click the buttons below to configure settings.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '💬 Channel', value: `#${config.channelName || 'Not set'}`, inline: true },
                { name: '📝 Custom Message', value: config.customMessage ? '✅ Set' : '❌ Using default', inline: true },
                { name: '💭 Message Preview', value: messagePreview, inline: false },
                { name: '🔖 Placeholders', value: '`{user}` `{server}` `{memberCount}`', inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure leave messages' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leave_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('leave_set_channel')
                    .setLabel('Set Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('leave_set_message')
                    .setLabel('Set Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('leave_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
    }
    
    // Setupname command - Interactive Panel
    if (interaction.commandName === 'setupname') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.autoNickname) {
            settings.autoNickname = { enabled: false, prefix: '', suffix: '' };
        }
        const config = settings.autoNickname;
        
        const exampleResult = `${config.prefix || ''}Username${config.suffix || ''}`;
        
        const embed = new EmbedBuilder()
            .setTitle('📝 Auto-Nickname Control Panel')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Automatically set nicknames for new members.\n\n` +
                `Click the buttons below to configure settings.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '⬅️ Prefix', value: config.prefix || 'None', inline: true },
                { name: '➡️ Suffix', value: config.suffix || 'None', inline: true },
                { name: '📋 Example', value: `\`Username\` → \`${exampleResult}\``, inline: false },
                { name: 'ℹ️ Note', value: 'Max nickname length is 32 characters', inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure auto-nickname' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('autonick_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('autonick_set_prefix')
                    .setLabel('Set Prefix')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⬅️'),
                new ButtonBuilder()
                    .setCustomId('autonick_set_suffix')
                    .setLabel('Set Suffix')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➡️'),
                new ButtonBuilder()
                    .setCustomId('autonick_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
    }
    
    // Games command - Show games menu
    if (interaction.commandName === 'games') {
        try {
            const gamesEmbed = new EmbedBuilder()
                .setTitle('🎮 Games Menu')
                .setDescription('Choose a game to play from the buttons below!')
                .setColor(0x5865F2)
                .addFields(
                    { name: '🐍 Snake', value: 'Classic snake game', inline: true },
                    { name: '⭕ Tic-Tac-Toe', value: 'Play with a friend', inline: true },
                    { name: '🔴 Connect 4', value: 'Play with a friend', inline: true },
                    { name: '📝 Wordle', value: 'Guess the word', inline: true },
                    { name: '💣 Minesweeper', value: 'Avoid the mines', inline: true },
                    { name: '🔢 2048', value: 'Number puzzle', inline: true },
                    { name: '🧠 Memory', value: 'Match pairs', inline: true },
                    { name: '⏱️ Fast Type', value: 'Typing test', inline: true },
                    { name: '🔍 Find Emoji', value: 'Find the emoji', inline: true },
                    { name: '🎮 Guess Pokémon', value: 'Name that Pokémon', inline: true },
                    { name: '🪨 RPS', value: 'Rock Paper Scissors', inline: true },
                    { name: '🎲 Hangman', value: 'Guess the word', inline: true },
                    { name: '🧠 Trivia', value: 'Answer questions', inline: true },
                    { name: '🎰 Slots', value: 'Slot machine', inline: true },
                    { name: '🤔 Would You Rather', value: 'Decision game', inline: true }
                )
                .setFooter({ text: 'Click a button to start playing!' })
                .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('game_snake')
                    .setLabel('Snake')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_tictactoe')
                    .setLabel('Tic-Tac-Toe')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_connect4')
                    .setLabel('Connect 4')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_wordle')
                    .setLabel('Wordle')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_minesweeper')
                    .setLabel('Minesweeper')
                                        .setStyle(ButtonStyle.Primary)
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('game_2048')
                    .setLabel('2048')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_memory')
                    .setLabel('Memory')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_fasttype')
                    .setLabel('Fast Type')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_findemoji')
                    .setLabel('Find Emoji')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_guesspokemon')
                    .setLabel('Guess Pokémon')
                                        .setStyle(ButtonStyle.Primary)
            );
        
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('game_rps')
                    .setLabel('RPS')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_hangman')
                    .setLabel('Hangman')
                                        .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('game_trivia')
                    .setLabel('Trivia')
                                        .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('game_slots')
                    .setLabel('Slots')
                                        .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('game_wouldyourather')
                    .setLabel('Would You Rather')
                                        .setStyle(ButtonStyle.Success)
            );
        
            await interaction.reply({ 
                embeds: [gamesEmbed], 
                components: [row1, row2, row3]
            });
        } catch (error) {
            console.error('Error displaying games menu:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ An error occurred while loading the games menu. Please try again!', 
                    ephemeral: true 
                }).catch(() => {});
            }
        }
    }
    
    // Comprehensive Logging System - Interactive Panel
    if (interaction.commandName === 'logs') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        
        // Initialize logging settings if they don't exist
        if (!settings.logging) {
            settings.logging = {
                enabled: false,
                channels: {
                    critical: null,
                    moderation: null,
                    messages: null,
                    members: null,
                    voice: null,
                    server: null,
                    keywords: null
                },
                logTypes: {
                    critical: true,
                    moderation: true,
                    messageDelete: true,
                    messageEdit: true,
                    memberJoin: true,
                    memberLeave: true,
                    roleChange: false,
                    voiceJoin: false,
                    voiceLeave: false,
                    channelCreate: false,
                    channelDelete: false,
                    keywordFlag: true
                }
            };
            saveSettings();
        }
        
        const config = settings.logging;
        
        // Create interactive panel
        const criticalChan = config.channels.critical ? `<#${config.channels.critical}>` : 'Not set';
        const modChan = config.channels.moderation ? `<#${config.channels.moderation}>` : 'Not set';
        const msgChan = config.channels.messages ? `<#${config.channels.messages}>` : 'Not set';
        const memberChan = config.channels.members ? `<#${config.channels.members}>` : 'Not set';
        const voiceChan = config.channels.voice ? `<#${config.channels.voice}>` : 'Not set';
        const serverChan = config.channels.server ? `<#${config.channels.server}>` : 'Not set';
        const keywordChan = config.channels.keywords ? `<#${config.channels.keywords}>` : 'Not set';
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Server Logging System')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Active Logs', value: `${Object.values(config.logTypes).filter(v => v).length}/12 types`, inline: true },
                { name: 'Channels Set', value: `${Object.values(config.channels).filter(v => v).length}/7 configured`, inline: true },
                { name: '🔴 Critical Errors', value: criticalChan, inline: true },
                { name: '⚖️ Moderation', value: modChan, inline: true },
                { name: '💬 Messages', value: msgChan, inline: true },
                { name: '👥 Members', value: memberChan, inline: true },
                { name: '🔊 Voice', value: voiceChan, inline: true },
                { name: '🛠️ Server', value: serverChan, inline: true },
                { name: '🚨 Keywords', value: keywordChan, inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure logging channels' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('log_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('log_set_critical')
                    .setLabel('Critical')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔴'),
                new ButtonBuilder()
                    .setCustomId('log_set_moderation')
                    .setLabel('Moderation')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚖️'),
                new ButtonBuilder()
                    .setCustomId('log_set_messages')
                    .setLabel('Messages')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('log_set_members')
                    .setLabel('Members')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👥')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('log_set_voice')
                    .setLabel('Voice')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔊'),
                new ButtonBuilder()
                    .setCustomId('log_set_server')
                    .setLabel('Server')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛠️'),
                new ButtonBuilder()
                    .setCustomId('log_set_keywords')
                    .setLabel('Keywords')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🚨'),
                new ButtonBuilder()
                    .setCustomId('log_toggles')
                    .setLabel('Event Toggles')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚙️')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }
    
    // Raid protection command - Interactive Panel
    if (interaction.commandName === 'raidprotection') {
        if (!requireAdmin(interaction)) return;
        
        const guildId = interaction.guild.id;
        const settings = getGuildSettings(guildId);
        
        // Initialize raidProtection if it doesn't exist (for existing servers)
        if (!settings.raidProtection) {
            settings.raidProtection = {
                enabled: false,
                joinThreshold: 5,
                timeWindow: 10,
                action: 'kick',
                whitelist: [],
                notificationChannel: null,
                lockdownDuration: 300
            };
            saveSettings();
        }
        
        const config = settings.raidProtection;
        const whitelistUsers = config.whitelist.length > 0
            ? config.whitelist.map(id => `<@${id}>`).join(', ')
            : 'None';
        const notifChannel = config.notificationChannel ? `<#${config.notificationChannel}>` : 'Not set';
        const lockdownStatus = lockedServers.has(interaction.guild.id) ? '🔒 Active' : '🔓 None';
        const actionText = config.action === 'none' ? 'Monitor Only' : config.action === 'kick' ? 'Kick' : 'Ban';
        
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Raid Protection Control Panel')
            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Monitors for suspicious join patterns and takes automatic action.\n\n` +
                `Click the buttons below to configure settings.`
            )
            .addFields(
                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '👥 Join Threshold', value: `${config.joinThreshold} members`, inline: true },
                { name: '⏱️ Time Window', value: `${config.timeWindow} seconds`, inline: true },
                { name: '⚡ Action', value: actionText, inline: true },
                { name: '🔒 Lockdown Duration', value: config.lockdownDuration === 0 ? 'Manual unlock' : `${config.lockdownDuration}s`, inline: true },
                { name: '🔓 Current Lockdown', value: lockdownStatus, inline: true },
                { name: '📢 Notification Channel', value: notifChannel, inline: true },
                { name: '✅ Whitelisted Users', value: whitelistUsers.length > 100 ? whitelistUsers.substring(0, 100) + '...' : whitelistUsers, inline: true }
            )
            .setFooter({ text: 'Click buttons below to configure raid protection' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('raid_toggle')
                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                new ButtonBuilder()
                    .setCustomId('raid_set_threshold')
                    .setLabel('Set Threshold')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👥'),
                new ButtonBuilder()
                    .setCustomId('raid_set_timewindow')
                    .setLabel('Time Window')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('raid_set_action')
                    .setLabel('Set Action')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚡')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('raid_set_lockdown')
                    .setLabel('Lockdown Duration')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('raid_set_notification')
                    .setLabel('Notification Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('raid_whitelist')
                    .setLabel('Manage Whitelist')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('raid_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('raid_unlock')
                    .setLabel('Unlock Server')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔓')
                    .setDisabled(!lockedServers.has(interaction.guild.id))
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2, row3], ephemeral: true });
        return;
    }
    
    // Old raid protection subcommands (keeping for backwards compatibility)
    if (interaction.commandName === 'raidprotection_legacy') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        
        // Initialize raidProtection if it doesn't exist (for existing servers)
        if (!settings.raidProtection) {
            settings.raidProtection = {
                enabled: false,
                joinThreshold: 5,
                timeWindow: 10,
                action: 'kick',
                whitelist: [],
                notificationChannel: null,
                lockdownDuration: 300
            };
            saveSettings();
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        // All old subcommands removed - now using interactive panel above
        return interaction.reply({ 
            content: '⚠️ Please use the new `/raidprotection` interactive panel instead!', 
            ephemeral: true 
        });
    }
    
    // Moderator configuration command - Interactive Menu
    if (interaction.commandName === 'moderator') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        // Create interactive menu
        const modRoles = settings.moderation.moderatorRoles.length > 0
            ? settings.moderation.moderatorRoles.map(id => `<@&${id}>`).join(', ')
            : 'None (Admins only)';
        
        const logChan = settings.moderation.modLogChannel ? `<#${settings.moderation.modLogChannel}>` : 'Not set';
        const muteRole = settings.moderation.muteRole ? `<@&${settings.moderation.muteRole}>` : 'Not set';
        
        const menuEmbed = new EmbedBuilder()
            .setTitle('⚖️ Moderation System Control Panel')
            .setDescription(`System is currently **${settings.moderation.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\nUse the buttons below to configure moderation settings.`)
            .setColor(settings.moderation.enabled ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: '⚠️ Warning Threshold', value: `${settings.moderation.warningThreshold} warnings`, inline: true },
                { name: '⚡ Auto-Action', value: settings.moderation.autoAction.charAt(0).toUpperCase() + settings.moderation.autoAction.slice(1), inline: true },
                { name: '⏱️ Timeout Duration', value: `${settings.moderation.timeoutDuration / 60} minutes`, inline: true },
                { name: '📅 Warning Decay', value: settings.moderation.warningDecay === 0 ? 'Never' : `${settings.moderation.warningDecay} days`, inline: true },
                { name: '💬 DM on Action', value: settings.moderation.dmOnAction ? 'Yes' : 'No', inline: true },
                { name: '📝 Log Channel', value: logChan, inline: true },
                { name: '🔇 Mute Role', value: muteRole, inline: true },
                { name: '👮 Moderator Roles', value: modRoles, inline: false }
            )
            .setFooter({ text: 'Click a button to configure that setting' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mod_toggle')
                    .setLabel(settings.moderation.enabled ? 'Disable System' : 'Enable System')
                    .setStyle(settings.moderation.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(settings.moderation.enabled ? '❌' : '✅'),
                new ButtonBuilder()
                    .setCustomId('mod_threshold')
                    .setLabel('Set Threshold')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId('mod_autoaction')
                    .setLabel('Set Auto-Action')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚡'),
                new ButtonBuilder()
                    .setCustomId('mod_timeout')
                    .setLabel('Timeout Duration')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏱️')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mod_decay')
                    .setLabel('Warning Decay')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📅'),
                new ButtonBuilder()
                    .setCustomId('mod_dm')
                    .setLabel('Toggle DMs')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId('mod_logchannel')
                    .setLabel('Set Log Channel')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('mod_muterole')
                    .setLabel('Set Mute Role')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔇')
            );
        
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mod_addrole')
                    .setLabel('Add Mod Role')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('mod_removerole')
                    .setLabel('Remove Mod Role')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('➖'),
                new ButtonBuilder()
                    .setCustomId('mod_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        return interaction.reply({ embeds: [menuEmbed], components: [row1, row2, row3], ephemeral: true });
    }
    
    // Warn command
    if (interaction.commandName === 'warn') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!settings.moderation.enabled) {
            return interaction.reply({ content: '❌ Moderation system is disabled!', ephemeral: true });
        }
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        if (member.id === interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot warn yourself!', ephemeral: true });
        }
        
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You cannot warn administrators!', ephemeral: true });
        }
        
        const warningCount = await addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
        addInfraction(interaction.guild.id, user.id, 'warn', interaction.user.id, reason);
        
        // DM user if enabled
        if (settings.moderation.dmOnAction) {
            try {
                await user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Warning Received')
                        .setDescription(`You have been warned in **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason },
                            { name: 'Total Warnings', value: warningCount.toString() },
                            { name: 'Threshold', value: `${settings.moderation.warningThreshold} warnings` }
                        )
                        .setColor(0xFFAA00)
                        .setTimestamp()]
                });
            } catch (e) {
                // User has DMs disabled
            }
        }
        
        await logModerationAction(interaction.guild, '⚠️ Warning', interaction.user, user, reason, { warnings: warningCount });
        
        const embed = new EmbedBuilder()
            .setTitle('✅ User Warned')
            .setDescription(`${user} has been warned.`)
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Total Warnings', value: `${warningCount}/${settings.moderation.warningThreshold}` }
            )
            .setColor(0xFFAA00);
        
        await interaction.reply({ embeds: [embed] });
        
        // Check if threshold reached
        if (warningCount >= settings.moderation.warningThreshold && settings.moderation.autoAction !== 'none') {
            const action = settings.moderation.autoAction;
            
            try {
                if (action === 'timeout') {
                    await member.timeout(settings.moderation.timeoutDuration * 1000, `Auto-timeout: ${warningCount} warnings`);
                    await interaction.followUp({ content: `🔇 ${user} has been auto-timed out for reaching the warning threshold!`, ephemeral: true });
                    await logModerationAction(interaction.guild, '🔇 Auto-Timeout', client.user, user, `Warning threshold reached (${warningCount} warnings)`, { duration: `${settings.moderation.timeoutDuration / 60} minutes` });
                } else if (action === 'kick') {
                    await member.kick(`Auto-kick: ${warningCount} warnings`);
                    await interaction.followUp({ content: `👢 ${user} has been auto-kicked for reaching the warning threshold!`, ephemeral: true });
                    await logModerationAction(interaction.guild, '👢 Auto-Kick', client.user, user, `Warning threshold reached (${warningCount} warnings)`);
                } else if (action === 'ban') {
                    await member.ban({ reason: `Auto-ban: ${warningCount} warnings` });
                    await interaction.followUp({ content: `🔨 ${user} has been auto-banned for reaching the warning threshold!`, ephemeral: true });
                    await logModerationAction(interaction.guild, '🔨 Auto-Ban', client.user, user, `Warning threshold reached (${warningCount} warnings)`);
                }
                
                if (settings.moderation.autoDeleteWarnings) {
                    moderationData[interaction.guild.id].warnings[user.id] = [];
                    saveModerationData();
                }
            } catch (error) {
                await interaction.followUp({ content: `❌ Failed to auto-${action}: ${error.message}`, ephemeral: true });
            }
        }
    }
    
    // Warnings command
    if (interaction.commandName === 'warnings') {
        const user = interaction.options.getUser('user');
        initializeModerationData(interaction.guild.id);
        
        const warnings = moderationData[interaction.guild.id].warnings[user.id] || [];
        
        if (warnings.length === 0) {
            return interaction.reply({ content: `${user} has no warnings.`, ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Warnings for ${user.tag}`)
            .setColor(0xFFAA00)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`Total warnings: **${warnings.length}**`);
        
        warnings.slice(-10).reverse().forEach((warn, index) => {
            const date = new Date(warn.timestamp);
            embed.addFields({
                name: `Warning #${warnings.length - index}`,
                value: `**Reason:** ${warn.reason}\n**Moderator:** <@${warn.moderatorId}>\n**Date:** <t:${Math.floor(date.getTime() / 1000)}:F>`,
                inline: false
            });
        });
        
        if (warnings.length > 10) {
            embed.setFooter({ text: `Showing 10 most recent warnings out of ${warnings.length} total` });
        }
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Clear warnings command
    if (interaction.commandName === 'clearwarnings') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        initializeModerationData(interaction.guild.id);
        
        const warningCount = (moderationData[interaction.guild.id].warnings[user.id] || []).length;
        moderationData[interaction.guild.id].warnings[user.id] = [];
        saveModerationData();
        
        await logModerationAction(interaction.guild, '🧹 Warnings Cleared', interaction.user, user, `Cleared ${warningCount} warnings`);
        
        return interaction.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle('✅ Warnings Cleared')
                .setDescription(`Cleared **${warningCount}** warnings for ${user}`)
                .setColor(0x00FF00)] 
        });
    }
    
    // Timeout command
    if (interaction.commandName === 'timeout') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You cannot timeout administrators!', ephemeral: true });
        }
        
        try {
            await member.timeout(duration * 60 * 1000, reason);
            addInfraction(interaction.guild.id, user.id, 'timeout', interaction.user.id, reason);
            
            if (settings.moderation.dmOnAction) {
                try {
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔇 You Have Been Timed Out')
                            .setDescription(`You have been timed out in **${interaction.guild.name}**`)
                            .addFields(
                                { name: 'Duration', value: `${duration} minutes` },
                                { name: 'Reason', value: reason }
                            )
                            .setColor(0xFFA500)
                            .setTimestamp()]
                    });
                } catch (e) {}
            }
            
            await logModerationAction(interaction.guild, '🔇 Timeout', interaction.user, user, reason, { duration: `${duration} minutes` });
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Timed Out')
                    .setDescription(`${user} has been timed out for **${duration} minutes**`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor(0xFFA500)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to timeout user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Untimeout command
    if (interaction.commandName === 'untimeout') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        try {
            await member.timeout(null);
            await logModerationAction(interaction.guild, '✅ Timeout Removed', interaction.user, user, 'Timeout removed by moderator');
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Timeout Removed')
                    .setDescription(`Timeout removed from ${user}`)
                    .setColor(0x00FF00)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to remove timeout: ${error.message}`, ephemeral: true });
        }
    }
    
    // Kick command
    if (interaction.commandName === 'kick') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You cannot kick administrators!', ephemeral: true });
        }
        
        if (!member.kickable) {
            return interaction.reply({ content: '❌ I cannot kick this user (role hierarchy)!', ephemeral: true });
        }
        
        try {
            addInfraction(interaction.guild.id, user.id, 'kick', interaction.user.id, reason);
            
            if (settings.moderation.dmOnAction) {
                try {
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('👢 You Have Been Kicked')
                            .setDescription(`You have been kicked from **${interaction.guild.name}**`)
                            .addFields({ name: 'Reason', value: reason })
                            .setColor(0xFF6600)
                            .setTimestamp()]
                    });
                } catch (e) {}
            }
            
            await member.kick(reason);
            await logModerationAction(interaction.guild, '👢 Kick', interaction.user, user, reason);
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Kicked')
                    .setDescription(`${user} has been kicked`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor(0xFF6600)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to kick user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Ban command
    if (interaction.commandName === 'ban') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('deletemessages') || 0;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (member) {
            if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ You cannot ban administrators!', ephemeral: true });
            }
            
            if (!member.bannable) {
                return interaction.reply({ content: '❌ I cannot ban this user (role hierarchy)!', ephemeral: true });
            }
        }
        
        try {
            addInfraction(interaction.guild.id, user.id, 'ban', interaction.user.id, reason);
            
            if (settings.moderation.dmOnAction && member) {
                try {
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔨 You Have Been Banned')
                            .setDescription(`You have been banned from **${interaction.guild.name}**`)
                            .addFields({ name: 'Reason', value: reason })
                            .setColor(0xFF0000)
                            .setTimestamp()]
                    });
                } catch (e) {}
            }
            
            await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: deleteDays * 86400 });
            await logModerationAction(interaction.guild, '🔨 Ban', interaction.user, user, reason);
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Banned')
                    .setDescription(`${user} has been banned`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor(0xFF0000)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to ban user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Unban command
    if (interaction.commandName === 'unban') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        const userId = interaction.options.getString('userid');
        
        try {
            await interaction.guild.members.unban(userId);
            await logModerationAction(interaction.guild, '✅ Unban', interaction.user, { id: userId, tag: userId }, 'User unbanned');
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Unbanned')
                    .setDescription(`User ID ${userId} has been unbanned`)
                    .setColor(0x00FF00)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to unban user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Mute command
    if (interaction.commandName === 'mute') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        if (!settings.moderation.muteRole) {
            return interaction.reply({ content: '❌ Mute role not configured! Use `/moderator muterole` to set it.', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ You cannot mute administrators!', ephemeral: true });
        }
        
        try {
            await member.roles.add(settings.moderation.muteRole);
            initializeModerationData(interaction.guild.id);
            
            if (!moderationData[interaction.guild.id].mutedUsers.includes(user.id)) {
                moderationData[interaction.guild.id].mutedUsers.push(user.id);
                saveModerationData();
            }
            
            addInfraction(interaction.guild.id, user.id, 'mute', interaction.user.id, reason);
            
            if (settings.moderation.dmOnAction) {
                try {
                    await user.send({
                        embeds: [new EmbedBuilder()
                            .setTitle('🔇 You Have Been Muted')
                            .setDescription(`You have been muted in **${interaction.guild.name}**`)
                            .addFields({ name: 'Reason', value: reason })
                            .setColor(0xFFA500)
                            .setTimestamp()]
                    });
                } catch (e) {}
            }
            
            await logModerationAction(interaction.guild, '🔇 Mute', interaction.user, user, reason);
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Muted')
                    .setDescription(`${user} has been muted`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor(0xFFA500)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to mute user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Unmute command
    if (interaction.commandName === 'unmute') {
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (!isModerator(interaction.member, settings)) {
            return interaction.reply({ content: '❌ You need moderator permissions!', ephemeral: true });
        }
        
        if (!settings.moderation.muteRole) {
            return interaction.reply({ content: '❌ Mute role not configured!', ephemeral: true });
        }
        
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
        }
        
        try {
            await member.roles.remove(settings.moderation.muteRole);
            initializeModerationData(interaction.guild.id);
            
            const index = moderationData[interaction.guild.id].mutedUsers.indexOf(user.id);
            if (index > -1) {
                moderationData[interaction.guild.id].mutedUsers.splice(index, 1);
                saveModerationData();
            }
            
            await logModerationAction(interaction.guild, '✅ Unmute', interaction.user, user, 'User unmuted');
            
            return interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('✅ User Unmuted')
                    .setDescription(`${user} has been unmuted`)
                    .setColor(0x00FF00)] 
            });
        } catch (error) {
            return interaction.reply({ content: `❌ Failed to unmute user: ${error.message}`, ephemeral: true });
        }
    }
    
    // Infractions command
    if (interaction.commandName === 'infractions') {
        const user = interaction.options.getUser('user');
        initializeModerationData(interaction.guild.id);
        
        const infractions = moderationData[interaction.guild.id].infractions[user.id] || [];
        
        if (infractions.length === 0) {
            return interaction.reply({ content: `${user} has no infractions.`, ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`📋 Infractions for ${user.tag}`)
            .setColor(0xFF0000)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`Total infractions: **${infractions.length}**`);
        
        infractions.slice(-10).reverse().forEach((infraction, index) => {
            const date = new Date(infraction.timestamp);
            const typeEmoji = {
                warn: '⚠️',
                timeout: '🔇',
                kick: '👢',
                ban: '🔨',
                mute: '🔇'
            }[infraction.type] || '📝';
            
            embed.addFields({
                name: `${typeEmoji} ${infraction.type.charAt(0).toUpperCase() + infraction.type.slice(1)} #${infractions.length - index}`,
                value: `**Reason:** ${infraction.reason}\n**Moderator:** <@${infraction.moderatorId}>\n**Date:** <t:${Math.floor(date.getTime() / 1000)}:F>`,
                inline: false
            });
        });
        
        if (infractions.length > 10) {
            embed.setFooter({ text: `Showing 10 most recent infractions out of ${infractions.length} total` });
        }
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Ticket Transcript command - View ticket transcript (Staff only)
    if (interaction.commandName === 'transcript') {
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        
        const ticketInfo = ticketData[guildId].tickets[interaction.channel.id];
        
        if (!ticketInfo) {
            return interaction.reply({ 
                content: '❌ This is not a ticket channel!', 
                ephemeral: true 
            });
        }
        
        // Check permissions (Staff only)
        const hasStaffRole = ticketData[guildId].settings.staffRoleId && 
            interaction.member.roles.cache.has(ticketData[guildId].settings.staffRoleId);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
            !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !hasStaffRole) {
            return interaction.reply({ 
                content: '❌ You need to be a staff member, administrator, or have Manage Channels permission to view transcript!', 
                ephemeral: true 
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const transcript = await generateTranscript(interaction.channel);
            
            if (transcript) {
                const transcriptBuffer = Buffer.from(transcript, 'utf-8');
                const creator = await client.users.fetch(ticketInfo.creator);
                
                const logsEmbed = new EmbedBuilder()
                    .setTitle(`📋 Ticket #${ticketInfo.number} Transcript`)
                    .setDescription(
                        `**� Creator:** ${creator.tag}\n` +
                        `**📅 Created:** <t:${Math.floor(ticketInfo.createdAt / 1000)}:F>\n` +
                        `**📝 Reason:** ${ticketInfo.reason}\n` +
                        `**🔔 Status:** ${ticketInfo.status === 'open' ? '🟢 Open' : '🔴 Closed'}\n` +
                        `**✋ Claimed:** ${ticketInfo.claimed ? `Yes, by <@${ticketInfo.claimedBy}>` : 'No'}\n\n` +
                        `Transcript file attached below.`
                    )
                    .setColor(0x3498DB)
                    .setTimestamp();
                
                await interaction.editReply({
                    embeds: [logsEmbed],
                    files: [{
                        attachment: transcriptBuffer,
                        name: `ticket-${ticketInfo.number}-transcript.txt`
                    }]
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ Failed to generate transcript.' 
                });
            }
        } catch (error) {
            console.error('Error generating transcript:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while generating the transcript.' 
            });
        }
    }
    
    // Ticket command - Interactive ticket creation panel
    if (interaction.commandName === 'ticket') {
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        
        // Check if ticket system is enabled
        if (!ticketData[guildId].settings.enabled) {
            return interaction.reply({ 
                content: '❌ The ticket system is not enabled on this server. Please ask an administrator to enable it using `/setuptickets enable`!', 
                ephemeral: true 
            });
        }
        
        // Create interactive panel embed
        const ticketPanelEmbed = new EmbedBuilder()
            .setTitle('🎫 Create Support Ticket')
            .setDescription(
                '**Need help from our support team?**\n\n' +
                'Click the button below to open a private support ticket. ' +
                'A new channel will be created where you can discuss your issue with our staff.\n\n' +
                '**What to expect:**\n' +
                '• A private channel will be created for you\n' +
                '• Only you and staff members can see it\n' +
                '• Our team will respond as soon as possible\n' +
                '• You can close the ticket when your issue is resolved\n\n' +
                '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                '**Ready to get help?** Click the button below! 👇'
            )
            .setColor(0x5865F2)
            .setFooter({ text: `${interaction.guild.name} Support System` })
            .setTimestamp();
        
        const createTicketButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_panel')
                    .setLabel('Open Support Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );
        
        await interaction.reply({ 
            embeds: [ticketPanelEmbed], 
            components: [createTicketButton],
            ephemeral: true 
        });
    }

    // YouTube Notifications command - Interactive panel
    if (interaction.commandName === 'youtubenotifications') {
        const ytCommand = require('./commands/youtubenotifications.js');
        await ytCommand.execute(interaction);
        return;
    }

    // Setup ticket system command
    if (interaction.commandName === 'setuptickets') {
        if (!requireAdmin(interaction)) return;
        
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'enable') {
            ticketData[guildId].settings.enabled = true;
            saveTicketData();
            
            const enableEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket System Enabled')
                .setDescription(
                    '🎫 The ticket system has been enabled!\n\n' +
                    '**Next Steps:**\n' +
                    '• Set a staff role: `/setuptickets staffrole <role>`\n' +
                    '• Customize messages: `/setuptickets message <type>`\n' +
                    '• Change category name: `/setuptickets category <name>`\n' +
                    '• Create a ticket panel: `/setuptickets panel <channel>`\n\n' +
                    'Users can create tickets by clicking the button on the ticket panel!'
                )
                .setColor(0x00FF00)
                .setTimestamp();
            
            return interaction.reply({ embeds: [enableEmbed] });
        }
        
        if (subcommand === 'disable') {
            ticketData[guildId].settings.enabled = false;
            saveTicketData();
            
            return interaction.reply({ 
                content: '🔴 Ticket system has been disabled. Users cannot create new tickets.', 
                ephemeral: true 
            });
        }
        
        if (subcommand === 'staffrole') {
            const role = interaction.options.getRole('role');
            ticketData[guildId].settings.staffRoleId = role.id;
            saveTicketData();
            
            return interaction.reply({ 
                content: `✅ Staff role set to ${role}. Members with this role can view and claim all tickets!`, 
                ephemeral: true 
            });
        }
        
        if (subcommand === 'category') {
            const categoryName = interaction.options.getString('name');
            ticketData[guildId].settings.categoryName = categoryName;
            saveTicketData();
            
            return interaction.reply({ 
                content: `✅ Ticket category name set to: **${categoryName}**`, 
                ephemeral: true 
            });
        }
        
        if (subcommand === 'ticketmessage') {
            const message = interaction.options.getString('message');
            ticketData[guildId].settings.ticketMessage = message;
            saveTicketData();
            
            const previewEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket Message Updated')
                .setDescription('**Preview:**\n\n' + message)
                .setColor(0x00FF00)
                .setFooter({ text: 'This message will appear in new tickets' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
        }
        
        if (subcommand === 'closedmessage') {
            const message = interaction.options.getString('message');
            ticketData[guildId].settings.closedMessage = message;
            saveTicketData();
            
            const previewEmbed = new EmbedBuilder()
                .setTitle('✅ Closed Message Updated')
                .setDescription('**Preview:**\n\n' + message)
                .setColor(0x00FF00)
                .setFooter({ text: 'This message will appear in DMs when tickets close' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
        }
        
        if (subcommand === 'view') {
            const settings = ticketData[guildId].settings;
            const staffRole = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set';
            
            const viewEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket System Settings')
                .setDescription(
                    `**Status:** ${settings.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n` +
                    `**Staff Role:** ${staffRole}\n` +
                    `**Category Name:** ${settings.categoryName}\n` +
                    `**Total Tickets:** ${ticketData[guildId].counter}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**📝 Ticket Welcome Message:**\n${settings.ticketMessage}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**🔒 Closed DM Message:**\n${settings.closedMessage}`
                )
                .setColor(0x3498DB)
                .setTimestamp();
            
            return interaction.reply({ embeds: [viewEmbed], ephemeral: true });
        }
        
        if (subcommand === 'panel') {
            const channel = interaction.options.getChannel('channel');
            
            if (channel.type !== ChannelType.GuildText) {
                return interaction.reply({ 
                    content: '❌ Please select a text channel!', 
                    ephemeral: true 
                });
            }
            
            const panelEmbed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket System')
                .setDescription(
                    '**Need help?** Create a support ticket!\n\n' +
                    '**How it works:**\n' +
                    '• Click the button below to open a ticket\n' +
                    '• A private channel will be created for you\n' +
                    '• Our staff team will assist you shortly\n\n' +
                    '**What to include:**\n' +
                    '• Describe your issue clearly\n' +
                    '• Include any relevant details\n' +
                    '• Be patient while we help you\n\n' +
                    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                    '**Click the button below to get started! 👇**'
                )
                .setColor(0x5865F2)
                .setFooter({ text: `${interaction.guild.name} Support` })
                .setTimestamp();
            
            const panelButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket_panel')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎫')
                );
            
            try {
                await channel.send({ 
                    embeds: [panelEmbed], 
                    components: [panelButton] 
                });
                
                await interaction.reply({ 
                    content: `✅ Ticket panel created in ${channel}!`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Error creating ticket panel:', error);
                await interaction.reply({ 
                    content: '❌ Failed to create ticket panel. Make sure I have permission to send messages in that channel!', 
                    ephemeral: true 
                });
            }
        }
    }
        } // End slash command handling
    
        // Handle button interactions
        else if (interaction.isButton()) {
            const guildId = interaction.guild.id;
            
            // YouTube notifications button handlers - FIRST PRIORITY
            if (interaction.customId.startsWith('yt_')) {
                try {
                    delete require.cache[require.resolve('./commands/youtubenotifications.js')];
                    const ytCommand = require('./commands/youtubenotifications.js');
                    await ytCommand.handleButton(interaction);
                    return;
                } catch (error) {
                    console.error('❌ YouTube button error:', error);
                    console.error('Stack trace:', error.stack);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ 
                                content: '❌ An error occurred while processing YouTube notifications. Please try again or contact an admin.', 
                                ephemeral: true 
                            });
                        } else if (interaction.deferred) {
                            await interaction.editReply({ 
                                content: '❌ An error occurred while processing YouTube notifications. Please try again or contact an admin.' 
                            });
                        }
                    } catch (replyError) {
                        console.error('Failed to send YouTube error message:', replyError);
                    }
                    return;
                }
            }
            
            // Logging system button handlers
            if (interaction.customId.startsWith('log_')) {
                if (!requireAdmin(interaction)) return;
                
                const settings = getGuildSettings(guildId);
                if (!settings.logging) {
                    settings.logging = {
                        enabled: false,
                        channels: { critical: null, moderation: null, messages: null, members: null, voice: null, server: null, keywords: null },
                        logTypes: { critical: true, moderation: true, messageDelete: true, messageEdit: true, memberJoin: true, memberLeave: true, roleChange: false, voiceJoin: false, voiceLeave: false, channelCreate: false, channelDelete: false, keywordFlag: true }
                    };
                }
                
                try {
                    if (interaction.customId === 'log_toggle') {
                        settings.logging.enabled = !settings.logging.enabled;
                        saveSettings();
                        
                        // Update the panel
                        const config = settings.logging;
                        const criticalChan = config.channels.critical ? `<#${config.channels.critical}>` : 'Not set';
                        const modChan = config.channels.moderation ? `<#${config.channels.moderation}>` : 'Not set';
                        const msgChan = config.channels.messages ? `<#${config.channels.messages}>` : 'Not set';
                        const memberChan = config.channels.members ? `<#${config.channels.members}>` : 'Not set';
                        const voiceChan = config.channels.voice ? `<#${config.channels.voice}>` : 'Not set';
                        const serverChan = config.channels.server ? `<#${config.channels.server}>` : 'Not set';
                        const keywordChan = config.channels.keywords ? `<#${config.channels.keywords}>` : 'Not set';
                        
                        const embed = new EmbedBuilder()
                            .setTitle('📋 Server Logging System')
                            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                            .addFields(
                                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                                { name: 'Active Logs', value: `${Object.values(config.logTypes).filter(v => v).length}/12 types`, inline: true },
                                { name: 'Channels Set', value: `${Object.values(config.channels).filter(v => v).length}/7 configured`, inline: true },
                                { name: '🔴 Critical Errors', value: criticalChan, inline: true },
                                { name: '⚖️ Moderation', value: modChan, inline: true },
                                { name: '💬 Messages', value: msgChan, inline: true },
                                { name: '👥 Members', value: memberChan, inline: true },
                                { name: '🔊 Voice', value: voiceChan, inline: true },
                                { name: '🛠️ Server', value: serverChan, inline: true },
                                { name: '🚨 Keywords', value: keywordChan, inline: false }
                            )
                            .setFooter({ text: 'Click buttons below to configure logging channels' })
                            .setTimestamp();
                        
                        const row1 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('log_toggle')
                                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_critical')
                                    .setLabel('Critical')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('🔴'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_moderation')
                                    .setLabel('Moderation')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('⚖️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_messages')
                                    .setLabel('Messages')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('💬'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_members')
                                    .setLabel('Members')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('👥')
                            );
                        
                        const row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('log_set_voice')
                                    .setLabel('Voice')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🔊'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_server')
                                    .setLabel('Server')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🛠️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_keywords')
                                    .setLabel('Keywords')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🚨'),
                                new ButtonBuilder()
                                    .setCustomId('log_toggles')
                                    .setLabel('Event Toggles')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('⚙️')
                            );
                        
                        await interaction.update({ embeds: [embed], components: [row1, row2] });
                        return;
                    }
                    
                    // Channel setup buttons
                    if (interaction.customId.startsWith('log_set_')) {
                        const logType = interaction.customId.replace('log_set_', '');
                        
                        const typeNames = {
                            critical: 'Critical Errors',
                            moderation: 'Moderation Actions',
                            messages: 'Message Events',
                            members: 'Member Events',
                            voice: 'Voice Activity',
                            server: 'Server Changes',
                            keywords: 'Keyword Flags'
                        };
                        
                        const modal = new ModalBuilder()
                            .setCustomId(`log_modal_${logType}`)
                            .setTitle(`Set ${typeNames[logType]} Channel`);
                        
                        const channelInput = new TextInputBuilder()
                            .setCustomId('channel_id')
                            .setLabel('Channel ID or #mention')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter channel ID or paste #channel-mention')
                            .setRequired(true);
                        
                        const row = new ActionRowBuilder().addComponents(channelInput);
                        modal.addComponents(row);
                        
                        await interaction.showModal(modal);
                        return;
                    }
                    
                    // Event toggles button
                    if (interaction.customId === 'log_toggles') {
                        const config = settings.logging.logTypes;
                        const statusIcon = (enabled) => enabled ? '✅' : '❌';
                        
                        const toggleEmbed = new EmbedBuilder()
                            .setTitle('⚙️ Event Toggle Settings')
                            .setDescription('Click buttons below to toggle event types')
                            .setColor(0x3498db)
                            .addFields(
                                { name: 'Critical Errors', value: statusIcon(config.critical), inline: true },
                                { name: 'Moderation', value: statusIcon(config.moderation), inline: true },
                                { name: 'Message Delete', value: statusIcon(config.messageDelete), inline: true },
                                { name: 'Message Edit', value: statusIcon(config.messageEdit), inline: true },
                                { name: 'Member Join', value: statusIcon(config.memberJoin), inline: true },
                                { name: 'Member Leave', value: statusIcon(config.memberLeave), inline: true },
                                { name: 'Role Changes', value: statusIcon(config.roleChange), inline: true },
                                { name: 'Voice Join', value: statusIcon(config.voiceJoin), inline: true },
                                { name: 'Voice Leave', value: statusIcon(config.voiceLeave), inline: true },
                                { name: 'Channel Create', value: statusIcon(config.channelCreate), inline: true },
                                { name: 'Channel Delete', value: statusIcon(config.channelDelete), inline: true },
                                { name: 'Keyword Flags', value: statusIcon(config.keywordFlag), inline: true }
                            );
                        
                        const row1 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_critical')
                                    .setLabel('Critical')
                                    .setStyle(config.critical ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_moderation')
                                    .setLabel('Moderation')
                                    .setStyle(config.moderation ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_messageDelete')
                                    .setLabel('Msg Delete')
                                    .setStyle(config.messageDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_messageEdit')
                                    .setLabel('Msg Edit')
                                    .setStyle(config.messageEdit ? ButtonStyle.Success : ButtonStyle.Secondary)
                            );
                        
                        const row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_memberJoin')
                                    .setLabel('Join')
                                    .setStyle(config.memberJoin ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_memberLeave')
                                    .setLabel('Leave')
                                    .setStyle(config.memberLeave ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_roleChange')
                                    .setLabel('Roles')
                                    .setStyle(config.roleChange ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_voiceJoin')
                                    .setLabel('Voice Join')
                                    .setStyle(config.voiceJoin ? ButtonStyle.Success : ButtonStyle.Secondary)
                            );
                        
                        const row3 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_voiceLeave')
                                    .setLabel('Voice Leave')
                                    .setStyle(config.voiceLeave ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_channelCreate')
                                    .setLabel('Ch Create')
                                    .setStyle(config.channelCreate ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_channelDelete')
                                    .setLabel('Ch Delete')
                                    .setStyle(config.channelDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('logtoggle_keywordFlag')
                                    .setLabel('Keywords')
                                    .setStyle(config.keywordFlag ? ButtonStyle.Success : ButtonStyle.Secondary)
                            );
                        
                        const backRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('log_back')
                                    .setLabel('« Back to Main Panel')
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        
                        await interaction.reply({ embeds: [toggleEmbed], components: [row1, row2, row3, backRow], ephemeral: true });
                        return;
                    }
                    
                    // Back button - Return to main logging panel
                    if (interaction.customId === 'log_back') {
                        const settings = getGuildSettings(guildId);
                        const config = settings.logging;
                        
                        // Recreate main panel
                        const criticalChan = config.channels.critical ? `<#${config.channels.critical}>` : 'Not set';
                        const modChan = config.channels.moderation ? `<#${config.channels.moderation}>` : 'Not set';
                        const msgChan = config.channels.messages ? `<#${config.channels.messages}>` : 'Not set';
                        const memberChan = config.channels.members ? `<#${config.channels.members}>` : 'Not set';
                        const voiceChan = config.channels.voice ? `<#${config.channels.voice}>` : 'Not set';
                        const serverChan = config.channels.server ? `<#${config.channels.server}>` : 'Not set';
                        const keywordChan = config.channels.keywords ? `<#${config.channels.keywords}>` : 'Not set';
                        
                        const embed = new EmbedBuilder()
                            .setTitle('📋 Server Logging System')
                            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                            .addFields(
                                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                                { name: 'Active Logs', value: `${Object.values(config.logTypes).filter(v => v).length}/12 types`, inline: true },
                                { name: 'Channels Set', value: `${Object.values(config.channels).filter(v => v).length}/7 configured`, inline: true },
                                { name: '🔴 Critical Errors', value: criticalChan, inline: true },
                                { name: '⚖️ Moderation', value: modChan, inline: true },
                                { name: '💬 Messages', value: msgChan, inline: true },
                                { name: '👥 Members', value: memberChan, inline: true },
                                { name: '🔊 Voice', value: voiceChan, inline: true },
                                { name: '🛠️ Server', value: serverChan, inline: true },
                                { name: '🚨 Keywords', value: keywordChan, inline: false }
                            )
                            .setFooter({ text: 'Click buttons below to configure logging channels' })
                            .setTimestamp();
                        
                        const row1 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('log_toggle')
                                    .setLabel(config.enabled ? 'Disable' : 'Enable')
                                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_critical')
                                    .setLabel('Critical')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('🔴'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_moderation')
                                    .setLabel('Moderation')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('⚖️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_messages')
                                    .setLabel('Messages')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('💬'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_members')
                                    .setLabel('Members')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('👥')
                            );
                        
                        const row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('log_set_voice')
                                    .setLabel('Voice')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🔊'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_server')
                                    .setLabel('Server')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🛠️'),
                                new ButtonBuilder()
                                    .setCustomId('log_set_keywords')
                                    .setLabel('Keywords')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🚨'),
                                new ButtonBuilder()
                                    .setCustomId('log_toggles')
                                    .setLabel('Event Toggles')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('⚙️')
                            );
                        
                        await interaction.update({ embeds: [embed], components: [row1, row2] });
                        return;
                    }
                    
                } catch (error) {
                    console.error('❌ Logging panel error:', error);
                    console.error('Stack trace:', error.stack);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                    return;
                }
            }
            
            // Event toggle buttons
            if (interaction.customId.startsWith('logtoggle_')) {
                if (!requireAdmin(interaction)) return;
                
                const settings = getGuildSettings(guildId);
                const logType = interaction.customId.replace('logtoggle_', '');
                
                settings.logging.logTypes[logType] = !settings.logging.logTypes[logType];
                saveSettings();
                
                const config = settings.logging.logTypes;
                const statusIcon = (enabled) => enabled ? '✅' : '❌';
                
                const toggleEmbed = new EmbedBuilder()
                    .setTitle('⚙️ Event Toggle Settings')
                    .setDescription('Click buttons below to toggle event types')
                    .setColor(0x3498db)
                    .addFields(
                        { name: 'Critical Errors', value: statusIcon(config.critical), inline: true },
                        { name: 'Moderation', value: statusIcon(config.moderation), inline: true },
                        { name: 'Message Delete', value: statusIcon(config.messageDelete), inline: true },
                        { name: 'Message Edit', value: statusIcon(config.messageEdit), inline: true },
                        { name: 'Member Join', value: statusIcon(config.memberJoin), inline: true },
                        { name: 'Member Leave', value: statusIcon(config.memberLeave), inline: true },
                        { name: 'Role Changes', value: statusIcon(config.roleChange), inline: true },
                        { name: 'Voice Join', value: statusIcon(config.voiceJoin), inline: true },
                        { name: 'Voice Leave', value: statusIcon(config.voiceLeave), inline: true },
                        { name: 'Channel Create', value: statusIcon(config.channelCreate), inline: true },
                        { name: 'Channel Delete', value: statusIcon(config.channelDelete), inline: true },
                        { name: 'Keyword Flags', value: statusIcon(config.keywordFlag), inline: true }
                    );
                
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('logtoggle_critical')
                            .setLabel('Critical')
                            .setStyle(config.critical ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_moderation')
                            .setLabel('Moderation')
                            .setStyle(config.moderation ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_messageDelete')
                            .setLabel('Msg Delete')
                            .setStyle(config.messageDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_messageEdit')
                            .setLabel('Msg Edit')
                            .setStyle(config.messageEdit ? ButtonStyle.Success : ButtonStyle.Secondary)
                    );
                
                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('logtoggle_memberJoin')
                            .setLabel('Join')
                            .setStyle(config.memberJoin ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_memberLeave')
                            .setLabel('Leave')
                            .setStyle(config.memberLeave ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_roleChange')
                            .setLabel('Roles')
                            .setStyle(config.roleChange ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_voiceJoin')
                            .setLabel('Voice Join')
                            .setStyle(config.voiceJoin ? ButtonStyle.Success : ButtonStyle.Secondary)
                    );
                
                const row3 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('logtoggle_voiceLeave')
                            .setLabel('Voice Leave')
                            .setStyle(config.voiceLeave ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_channelCreate')
                            .setLabel('Ch Create')
                            .setStyle(config.channelCreate ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_channelDelete')
                            .setLabel('Ch Delete')
                            .setStyle(config.channelDelete ? ButtonStyle.Success : ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('logtoggle_keywordFlag')
                            .setLabel('Keywords')
                            .setStyle(config.keywordFlag ? ButtonStyle.Success : ButtonStyle.Secondary)
                    );
                
                const backRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('log_back')
                            .setLabel('« Back to Main Panel')
                            .setStyle(ButtonStyle.Secondary)
                    );
                
                await interaction.update({ embeds: [toggleEmbed], components: [row1, row2, row3, backRow] });
                return;
            }
            
            // AI system button handlers
            if (interaction.customId.startsWith('ai_')) {
                if (!requireAdmin(interaction)) return;
                
                const settings = getGuildSettings(guildId);
                if (!settings.ai) {
                    settings.ai = defaultSettings.ai;
                }
                
                try {
                    if (interaction.customId === 'ai_toggle') {
                        settings.ai.enabled = !settings.ai.enabled;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ AI chat ${settings.ai.enabled ? '**enabled**' : '**disabled**'}! ${settings.ai.enabled ? `Messages in **#${settings.ai.channelName}** will be answered automatically.` : ''}`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'ai_set_channel') {
                        const modal = new ModalBuilder()
                            .setCustomId('ai_channel_modal')
                            .setTitle('Set AI Channel');
                        
                        const channelInput = new TextInputBuilder()
                            .setCustomId('channel_name')
                            .setLabel('Channel name (without #)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('ai-chat')
                            .setValue(settings.ai.channelName)
                            .setRequired(true)
                            .setMaxLength(100);
                        
                        const row = new ActionRowBuilder().addComponents(channelInput);
                        modal.addComponents(row);
                        
                        await interaction.showModal(modal);
                    }
                    else if (interaction.customId === 'ai_set_history') {
                        const modal = new ModalBuilder()
                            .setCustomId('ai_history_modal')
                            .setTitle('Set Max History');
                        
                        const historyInput = new TextInputBuilder()
                            .setCustomId('max_history')
                            .setLabel('Max conversation exchanges to remember')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('3')
                            .setValue(settings.ai.maxHistory.toString())
                            .setRequired(true)
                            .setMaxLength(2);
                        
                        const row = new ActionRowBuilder().addComponents(historyInput);
                        modal.addComponents(row);
                        
                        await interaction.showModal(modal);
                    }
                    else if (interaction.customId === 'ai_set_temperature') {
                        const modal = new ModalBuilder()
                            .setCustomId('ai_temperature_modal')
                            .setTitle('Set AI Temperature');
                        
                        const tempInput = new TextInputBuilder()
                            .setCustomId('temperature')
                            .setLabel('Temperature (0.0 - 2.0)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('0.7')
                            .setValue(settings.ai.temperature.toString())
                            .setRequired(true)
                            .setMaxLength(4);
                        
                        const row = new ActionRowBuilder().addComponents(tempInput);
                        modal.addComponents(row);
                        
                        await interaction.showModal(modal);
                    }
                    else if (interaction.customId === 'ai_clear_history') {
                        // Count total conversations
                        const totalConvos = Object.keys(aiConversations).length;
                        
                        // Clear all AI conversations
                        for (const channelId in aiConversations) {
                            delete aiConversations[channelId];
                        }
                        
                        await interaction.reply({ 
                            content: `✅ Cleared all AI conversation history! (${totalConvos} channel${totalConvos !== 1 ? 's' : ''})`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'ai_refresh') {
                        const config = settings.ai;
                        
                        const embed = new EmbedBuilder()
                            .setTitle('🤖 AI Chat System Control Panel')
                            .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                            .setDescription(
                                `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                                `AI responds automatically to all messages in the designated channel using **${config.model}**.\n\n` +
                                `Click the buttons below to configure AI settings.`
                            )
                            .addFields(
                                { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                                { name: '💬 Channel', value: `#${config.channelName}`, inline: true },
                                { name: '🤖 Model', value: config.model, inline: true },
                                { name: '🧠 Max History', value: `${config.maxHistory} exchanges`, inline: true },
                                { name: '🌡️ Temperature', value: config.temperature.toString(), inline: true },
                                { name: '📝 System Prompt', value: config.systemPrompt.substring(0, 100) + '...', inline: false }
                            )
                            .setFooter({ text: 'Click buttons below to configure AI chat settings' })
                            .setTimestamp();
                        
                        const row1 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('ai_toggle')
                                    .setLabel(config.enabled ? 'Disable AI' : 'Enable AI')
                                    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                                    .setEmoji(config.enabled ? '⏸️' : '▶️'),
                                new ButtonBuilder()
                                    .setCustomId('ai_set_channel')
                                    .setLabel('Set Channel')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('💬'),
                                new ButtonBuilder()
                                    .setCustomId('ai_set_history')
                                    .setLabel('Max History')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('🧠'),
                                new ButtonBuilder()
                                    .setCustomId('ai_set_temperature')
                                    .setLabel('Temperature')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('🌡️')
                            );
                        
                        const row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('ai_clear_history')
                                    .setLabel('Clear All History')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🗑️'),
                                new ButtonBuilder()
                                    .setCustomId('ai_refresh')
                                    .setLabel('Refresh')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setEmoji('🔄')
                            );
                        
                        await interaction.update({ embeds: [embed], components: [row1, row2] });
                    }
                } catch (error) {
                    console.error('Error handling AI button:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                    return;
                }
            }
            
            initializeTicketSystem(guildId);
        
            // Feature toggle button handlers
            if (interaction.customId.startsWith('toggle_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Admin only!', ephemeral: true });
            }
            
            const settings = getGuildSettings(guildId);
            const feature = interaction.customId.replace('toggle_', '');
            
            if (feature === 'leveling') {
                settings.leveling.enabled = !settings.leveling.enabled;
                saveSettings();
                await interaction.reply({ content: `✅ Leveling system ${settings.leveling.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
            } else if (feature === 'keywords') {
                settings.keywords.enabled = !settings.keywords.enabled;
                saveSettings();
                await interaction.reply({ content: `✅ PS3 Error Detection ${settings.keywords.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
            } else if (feature === 'welcome') {
                settings.welcome.enabled = !settings.welcome.enabled;
                saveSettings();
                await interaction.reply({ content: `✅ Welcome messages ${settings.welcome.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
            } else if (feature === 'leave') {
                settings.leave.enabled = !settings.leave.enabled;
                saveSettings();
                await interaction.reply({ content: `✅ Leave messages ${settings.leave.enabled ? '**enabled**' : '**disabled**'}!`, ephemeral: true });
            }
        }
        
        // Server Stats button handlers
        if (interaction.customId.startsWith('stats_')) {
            if (!requireAdmin(interaction)) return;
            
            const settings = getGuildSettings(guildId);
            if (!settings.serverStats) {
                settings.serverStats = defaultSettings.serverStats;
            }
            
            if (interaction.customId === 'stats_toggle') {
                settings.serverStats.enabled = !settings.serverStats.enabled;
                saveSettings();
                if (settings.serverStats.enabled) {
                    startServerStatsUpdates();
                }
                await interaction.reply({ 
                    content: `✅ Server stats ${settings.serverStats.enabled ? '**enabled**' : '**disabled**'}!`, 
                    ephemeral: true 
                });
            }
            else if (interaction.customId === 'stats_setup') {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    
                    // Create a category for stats
                    const category = await interaction.guild.channels.create({
                        name: '📊 Server Stats',
                        type: ChannelType.GuildCategory
                    });
                    
                    // Create voice channels
                    const memberChannel = await interaction.guild.channels.create({
                        name: settings.serverStats.channelNames.memberCount.replace('{count}', '...'),
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.Connect]
                            }
                        ]
                    });
                    
                    const botChannel = await interaction.guild.channels.create({
                        name: settings.serverStats.channelNames.botCount.replace('{count}', '...'),
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.Connect]
                            }
                        ]
                    });
                    
                    const totalChannel = await interaction.guild.channels.create({
                        name: settings.serverStats.channelNames.totalCount.replace('{count}', '...'),
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.Connect]
                            }
                        ]
                    });
                    
                    const statusChannel = await interaction.guild.channels.create({
                        name: settings.serverStats.channelNames.statusChannel.replace('{status}', 'Online'),
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: interaction.guild.id,
                                deny: [PermissionFlagsBits.Connect]
                            }
                        ]
                    });
                    
                    // Save channel IDs
                    settings.serverStats.channels.memberCount = memberChannel.id;
                    settings.serverStats.channels.botCount = botChannel.id;
                    settings.serverStats.channels.totalCount = totalChannel.id;
                    settings.serverStats.channels.statusChannel = statusChannel.id;
                    saveSettings();
                    
                    // Immediate update
                    await updateServerStats(interaction.guild);
                    
                    await interaction.editReply({ content: '✅ Server stats channels created including bot status! They will update automatically.' });
                } catch (error) {
                    await interaction.editReply({ content: `❌ Error creating channels: ${error.message}` });
                }
            }
            else if (interaction.customId === 'stats_interval') {
                await interaction.reply({ 
                    content: '⏱️ **Set Update Interval**\nReply with a number between 1-60 (minutes):', 
                    ephemeral: true 
                });
                
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                    .catch(() => null);
                
                if (collected) {
                    const minutes = parseInt(collected.first().content);
                    if (minutes >= 1 && minutes <= 60) {
                        settings.serverStats.updateInterval = minutes * 60000;
                        saveSettings();
                        await collected.first().delete().catch(() => {});
                        await interaction.followUp({ 
                            content: `✅ Update interval set to **${minutes} minute(s)**! Restart bot to apply changes.`, 
                            ephemeral: true 
                        });
                    } else {
                        await interaction.followUp({ content: '❌ Invalid number! Must be 1-60 minutes.', ephemeral: true });
                    }
                }
            }
            else if (interaction.customId === 'stats_refresh') {
                await interaction.deferReply({ ephemeral: true });
                try {
                    await updateServerStats(interaction.guild);
                    await interaction.editReply({ content: '✅ Server stats refreshed successfully!' });
                } catch (error) {
                    await interaction.editReply({ content: `❌ Error refreshing stats: ${error.message}` });
                }
            }
        }
        
        // Moderator menu button handlers
        if (interaction.customId.startsWith('mod_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        if (interaction.customId === 'mod_toggle') {
            settings.moderation.enabled = !settings.moderation.enabled;
            saveSettings();
            await interaction.reply({ 
                content: `✅ Moderation system ${settings.moderation.enabled ? 'enabled' : 'disabled'}!`, 
                ephemeral: true 
            });
        }
        
        else if (interaction.customId === 'mod_threshold') {
            const modal = new ModalBuilder()
                .setCustomId('mod_threshold_modal')
                .setTitle('Set Warning Threshold');
            
            const thresholdInput = new TextInputBuilder()
                .setCustomId('threshold')
                .setLabel('Warning threshold (1-20)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('3')
                .setValue(settings.moderation.warningThreshold.toString())
                .setRequired(true)
                .setMaxLength(2);
            
            const row = new ActionRowBuilder().addComponents(thresholdInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_autoaction') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('mod_autoaction_select')
                        .setPlaceholder('Choose auto-action')
                        .addOptions([
                            { label: 'Timeout', value: 'timeout', description: 'Temporarily mute users', emoji: '🔇' },
                            { label: 'Kick', value: 'kick', description: 'Remove users from server', emoji: '👢' },
                            { label: 'Ban', value: 'ban', description: 'Permanently ban users', emoji: '🔨' },
                            { label: 'None', value: 'none', description: 'Only warnings, no action', emoji: '⚠️' }
                        ])
                );
            
            await interaction.reply({ content: '⚡ **Select Auto-Action:**', components: [row], ephemeral: true });
        }
        
        else if (interaction.customId === 'mod_timeout') {
            const modal = new ModalBuilder()
                .setCustomId('mod_timeout_modal')
                .setTitle('Set Timeout Duration');
            
            const durationInput = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel('Timeout duration in minutes (1-40320)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('10')
                .setValue((settings.moderation.timeoutDuration / 60).toString())
                .setRequired(true)
                .setMaxLength(5);
            
            const row = new ActionRowBuilder().addComponents(durationInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_decay') {
            const modal = new ModalBuilder()
                .setCustomId('mod_decay_modal')
                .setTitle('Set Warning Decay');
            
            const decayInput = new TextInputBuilder()
                .setCustomId('decay')
                .setLabel('Days before warnings expire (0-365, 0=never)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('30')
                .setValue(settings.moderation.warningDecay.toString())
                .setRequired(true)
                .setMaxLength(3);
            
            const row = new ActionRowBuilder().addComponents(decayInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_dm') {
            settings.moderation.dmOnAction = !settings.moderation.dmOnAction;
            saveSettings();
            await interaction.reply({ 
                content: `💬 DM notifications ${settings.moderation.dmOnAction ? 'enabled' : 'disabled'}!`, 
                ephemeral: true 
            });
        }
        
        else if (interaction.customId === 'mod_logchannel') {
            const modal = new ModalBuilder()
                .setCustomId('mod_logchannel_modal')
                .setTitle('Set Moderation Log Channel');
            
            const channelInput = new TextInputBuilder()
                .setCustomId('channel_id')
                .setLabel('Channel ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('#mod-logs or channel ID')
                .setRequired(true)
                .setMaxLength(100);
            
            const row = new ActionRowBuilder().addComponents(channelInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_muterole') {
            const modal = new ModalBuilder()
                .setCustomId('mod_muterole_modal')
                .setTitle('Set Mute Role');
            
            const roleInput = new TextInputBuilder()
                .setCustomId('role_id')
                .setLabel('Role ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@Muted or role ID')
                .setRequired(true)
                .setMaxLength(100);
            
            const row = new ActionRowBuilder().addComponents(roleInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_addrole') {
            const modal = new ModalBuilder()
                .setCustomId('mod_addrole_modal')
                .setTitle('Add Moderator Role');
            
            const roleInput = new TextInputBuilder()
                .setCustomId('role_id')
                .setLabel('Role ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@Moderator or role ID')
                .setRequired(true)
                .setMaxLength(100);
            
            const row = new ActionRowBuilder().addComponents(roleInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_removerole') {
            if (settings.moderation.moderatorRoles.length === 0) {
                return interaction.reply({ content: '❌ No moderator roles to remove!', ephemeral: true });
            }
            
            const modal = new ModalBuilder()
                .setCustomId('mod_removerole_modal')
                .setTitle('Remove Moderator Role');
            
            const roleInput = new TextInputBuilder()
                .setCustomId('role_id')
                .setLabel('Role ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@Moderator or role ID')
                .setRequired(true)
                .setMaxLength(100);
            
            const row = new ActionRowBuilder().addComponents(roleInput);
            modal.addComponents(row);
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'mod_refresh') {
            // Recreate the menu
            const modRoles = settings.moderation.moderatorRoles.length > 0
                ? settings.moderation.moderatorRoles.map(id => `<@&${id}>`).join(', ')
                : 'None (Admins only)';
            
            const logChan = settings.moderation.modLogChannel ? `<#${settings.moderation.modLogChannel}>` : 'Not set';
            const muteRole = settings.moderation.muteRole ? `<@&${settings.moderation.muteRole}>` : 'Not set';
            
            const menuEmbed = new EmbedBuilder()
                .setTitle('⚖️ Moderation System Control Panel')
                .setDescription(`System is currently **${settings.moderation.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\nUse the buttons below to configure moderation settings.`)
                .setColor(settings.moderation.enabled ? 0x00FF00 : 0xFF0000)
                .addFields(
                    { name: '⚠️ Warning Threshold', value: `${settings.moderation.warningThreshold} warnings`, inline: true },
                    { name: '⚡ Auto-Action', value: settings.moderation.autoAction.charAt(0).toUpperCase() + settings.moderation.autoAction.slice(1), inline: true },
                    { name: '⏱️ Timeout Duration', value: `${settings.moderation.timeoutDuration / 60} minutes`, inline: true },
                    { name: '📅 Warning Decay', value: settings.moderation.warningDecay === 0 ? 'Never' : `${settings.moderation.warningDecay} days`, inline: true },
                    { name: '💬 DM on Action', value: settings.moderation.dmOnAction ? 'Yes' : 'No', inline: true },
                    { name: '📝 Log Channel', value: logChan, inline: true },
                    { name: '🔇 Mute Role', value: muteRole, inline: true },
                    { name: '👮 Moderator Roles', value: modRoles, inline: false }
                )
                .setFooter({ text: 'Click a button to configure that setting' })
                .setTimestamp();
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('mod_toggle')
                        .setLabel(settings.moderation.enabled ? 'Disable System' : 'Enable System')
                        .setStyle(settings.moderation.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(settings.moderation.enabled ? '❌' : '✅'),
                    new ButtonBuilder()
                        .setCustomId('mod_threshold')
                        .setLabel('Set Threshold')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚠️'),
                    new ButtonBuilder()
                        .setCustomId('mod_autoaction')
                        .setLabel('Set Auto-Action')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚡'),
                    new ButtonBuilder()
                        .setCustomId('mod_timeout')
                        .setLabel('Timeout Duration')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏱️')
                );
            
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('mod_decay')
                        .setLabel('Warning Decay')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📅'),
                    new ButtonBuilder()
                        .setCustomId('mod_dm')
                        .setLabel('Toggle DMs')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId('mod_logchannel')
                        .setLabel('Set Log Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('mod_muterole')
                        .setLabel('Set Mute Role')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔇')
                );
            
            const row3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('mod_addrole')
                        .setLabel('Add Mod Role')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setCustomId('mod_removerole')
                        .setLabel('Remove Mod Role')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('➖'),
                    new ButtonBuilder()
                        .setCustomId('mod_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );
            
            await interaction.update({ embeds: [menuEmbed], components: [row1, row2, row3] });
        }
    }
    
    // Auto-action select menu handler
    if (interaction.isStringSelectMenu() && interaction.customId === 'mod_autoaction_select') {
        const settings = getGuildSettings(guildId);
        const action = interaction.values[0];
        settings.moderation.autoAction = action;
        saveSettings();
        
        const actionText = action === 'none' ? 'No auto-action' : `Auto-${action}`;
        await interaction.update({ content: `✅ Auto-action set to: **${actionText}**`, components: [] });
        return;
    }
    
    // Welcome system button handlers
    if (interaction.customId.startsWith('welcome_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        const config = settings.welcome;
        
        if (interaction.customId === 'welcome_toggle') {
            config.enabled = !config.enabled;
            saveSettings();
            await interaction.reply({ 
                content: `✅ Welcome system ${config.enabled ? '**enabled**' : '**disabled**'}!`, 
                ephemeral: true 
            });
        } else if (interaction.customId === 'welcome_set_channel') {
            const modal = new ModalBuilder()
                .setCustomId('welcome_channel_modal')
                .setTitle('Set Welcome Channel');
            
            const channelInput = new TextInputBuilder()
                .setCustomId('channel_name')
                .setLabel('Channel Name (without #)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('general')
                .setValue(config.channelName || '')
                .setRequired(true)
                .setMaxLength(100);
            
            modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'welcome_set_message') {
            const modal = new ModalBuilder()
                .setCustomId('welcome_message_modal')
                .setTitle('Set Welcome Message');
            
            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('Welcome Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Welcome {user} to {server}! You are member #{memberCount}!')
                .setValue(config.customMessage || 'Welcome {user} to {server}! You are member #{memberCount}!')
                .setRequired(true)
                .setMaxLength(1000);
            
            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'welcome_refresh') {
            const messagePreview = (config.customMessage || 'Welcome {user} to {server}! You are member #{memberCount}!')
                .substring(0, 200);
            
            const embed = new EmbedBuilder()
                .setTitle('👋 Welcome System Control Panel')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .setDescription(
                    `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                    `Automatically welcome new members with custom messages.\n\n` +
                    `Click the buttons below to configure settings.`
                )
                .addFields(
                    { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '💬 Channel', value: `#${config.channelName || 'Not set'}`, inline: true },
                    { name: '📝 Custom Message', value: config.customMessage ? '✅ Set' : '❌ Using default', inline: true },
                    { name: '💭 Message Preview', value: messagePreview, inline: false },
                    { name: '🔖 Placeholders', value: '`{user}` `{server}` `{memberCount}`', inline: false }
                )
                .setFooter({ text: 'Click buttons below to configure welcome messages' })
                .setTimestamp();
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('welcome_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('welcome_set_channel')
                        .setLabel('Set Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId('welcome_set_message')
                        .setLabel('Set Message')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('welcome_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );
            
            await interaction.update({ embeds: [embed], components: [row1] });
        }
    }
    
    // Leave system button handlers
    if (interaction.customId.startsWith('leave_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        const config = settings.leave;
        
        if (interaction.customId === 'leave_toggle') {
            config.enabled = !config.enabled;
            saveSettings();
            await interaction.reply({ 
                content: `✅ Leave system ${config.enabled ? '**enabled**' : '**disabled**'}!`, 
                ephemeral: true 
            });
        } else if (interaction.customId === 'leave_set_channel') {
            const modal = new ModalBuilder()
                .setCustomId('leave_channel_modal')
                .setTitle('Set Leave Channel');
            
            const channelInput = new TextInputBuilder()
                .setCustomId('channel_name')
                .setLabel('Channel Name (without #)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('general')
                .setValue(config.channelName || '')
                .setRequired(true)
                .setMaxLength(100);
            
            modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'leave_set_message') {
            const modal = new ModalBuilder()
                .setCustomId('leave_message_modal')
                .setTitle('Set Leave Message');
            
            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('Leave Message')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('{user} has left {server}. We now have {memberCount} members.')
                .setValue(config.customMessage || '{user} has left {server}. We now have {memberCount} members.')
                .setRequired(true)
                .setMaxLength(1000);
            
            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'leave_refresh') {
            const messagePreview = (config.customMessage || '{user} has left {server}. We now have {memberCount} members.')
                .substring(0, 200);
            
            const embed = new EmbedBuilder()
                .setTitle('👋 Leave System Control Panel')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .setDescription(
                    `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                    `Automatically announce when members leave the server.\n\n` +
                    `Click the buttons below to configure settings.`
                )
                .addFields(
                    { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '💬 Channel', value: `#${config.channelName || 'Not set'}`, inline: true },
                    { name: '📝 Custom Message', value: config.customMessage ? '✅ Set' : '❌ Using default', inline: true },
                    { name: '💭 Message Preview', value: messagePreview, inline: false },
                    { name: '🔖 Placeholders', value: '`{user}` `{server}` `{memberCount}`', inline: false }
                )
                .setFooter({ text: 'Click buttons below to configure leave messages' })
                .setTimestamp();
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('leave_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('leave_set_channel')
                        .setLabel('Set Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💬'),
                    new ButtonBuilder()
                        .setCustomId('leave_set_message')
                        .setLabel('Set Message')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('leave_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );
            
            await interaction.update({ embeds: [embed], components: [row1] });
        }
    }
    
    // Auto-Nickname system button handlers
    if (interaction.customId.startsWith('autonick_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        if (!settings.autoNickname) {
            settings.autoNickname = { enabled: false, prefix: '', suffix: '' };
        }
        const config = settings.autoNickname;
        
        if (interaction.customId === 'autonick_toggle') {
            config.enabled = !config.enabled;
            saveSettings();
            await interaction.reply({ 
                content: `✅ Auto-nickname ${config.enabled ? '**enabled**' : '**disabled**'}!`, 
                ephemeral: true 
            });
        } else if (interaction.customId === 'autonick_set_prefix') {
            const modal = new ModalBuilder()
                .setCustomId('autonick_prefix_modal')
                .setTitle('Set Nickname Prefix');
            
            const prefixInput = new TextInputBuilder()
                .setCustomId('prefix_text')
                .setLabel('Prefix (added before username)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('[PS3] ')
                .setValue(config.prefix || '')
                .setRequired(false)
                .setMaxLength(15);
            
            modal.addComponents(new ActionRowBuilder().addComponents(prefixInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'autonick_set_suffix') {
            const modal = new ModalBuilder()
                .setCustomId('autonick_suffix_modal')
                .setTitle('Set Nickname Suffix');
            
            const suffixInput = new TextInputBuilder()
                .setCustomId('suffix_text')
                .setLabel('Suffix (added after username)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(' | PSH')
                .setValue(config.suffix || '')
                .setRequired(false)
                .setMaxLength(15);
            
            modal.addComponents(new ActionRowBuilder().addComponents(suffixInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'autonick_refresh') {
            const exampleResult = `${config.prefix || ''}Username${config.suffix || ''}`;
            
            const embed = new EmbedBuilder()
                .setTitle('📝 Auto-Nickname Control Panel')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .setDescription(
                    `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                    `Automatically set nicknames for new members.\n\n` +
                    `Click the buttons below to configure settings.`
                )
                .addFields(
                    { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '⬅️ Prefix', value: config.prefix || 'None', inline: true },
                    { name: '➡️ Suffix', value: config.suffix || 'None', inline: true },
                    { name: '📋 Example', value: `\`Username\` → \`${exampleResult}\``, inline: false },
                    { name: 'ℹ️ Note', value: 'Max nickname length is 32 characters', inline: false }
                )
                .setFooter({ text: 'Click buttons below to configure auto-nickname' })
                .setTimestamp();
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('autonick_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('autonick_set_prefix')
                        .setLabel('Set Prefix')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⬅️'),
                    new ButtonBuilder()
                        .setCustomId('autonick_set_suffix')
                        .setLabel('Set Suffix')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('➡️'),
                    new ButtonBuilder()
                        .setCustomId('autonick_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );
            
            await interaction.update({ embeds: [embed], components: [row1] });
        }
    }
    
    // Raid Protection system button handlers
    if (interaction.customId.startsWith('raid_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        if (!settings.raidProtection) {
            settings.raidProtection = {
                enabled: false,
                joinThreshold: 5,
                timeWindow: 10,
                action: 'kick',
                whitelist: [],
                notificationChannel: null,
                lockdownDuration: 300
            };
        }
        const config = settings.raidProtection;
        
        if (interaction.customId === 'raid_toggle') {
            config.enabled = !config.enabled;
            saveSettings();
            
            // Clear any active lockdown if disabling
            if (!config.enabled && lockedServers.has(interaction.guild.id)) {
                lockedServers.delete(interaction.guild.id);
                const timer = lockdownTimers.get(interaction.guild.id);
                if (timer) {
                    clearTimeout(timer);
                    lockdownTimers.delete(interaction.guild.id);
                }
            }
            
            await interaction.reply({ 
                content: `✅ Raid protection ${config.enabled ? '**enabled**' : '**disabled**'}!`, 
                ephemeral: true 
            });
        } else if (interaction.customId === 'raid_set_threshold') {
            const modal = new ModalBuilder()
                .setCustomId('raid_threshold_modal')
                .setTitle('Set Join Threshold');
            
            const thresholdInput = new TextInputBuilder()
                .setCustomId('threshold_value')
                .setLabel('Join Threshold (2-50 members)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('5')
                .setValue(config.joinThreshold.toString())
                .setRequired(true)
                .setMaxLength(2);
            
            modal.addComponents(new ActionRowBuilder().addComponents(thresholdInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'raid_set_timewindow') {
            const modal = new ModalBuilder()
                .setCustomId('raid_timewindow_modal')
                .setTitle('Set Time Window');
            
            const timeInput = new TextInputBuilder()
                .setCustomId('time_value')
                .setLabel('Time Window (5-300 seconds)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('10')
                .setValue(config.timeWindow.toString())
                .setRequired(true)
                .setMaxLength(3);
            
            modal.addComponents(new ActionRowBuilder().addComponents(timeInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'raid_set_action') {
            const actionMenu = new StringSelectMenuBuilder()
                .setCustomId('raid_action_select')
                .setPlaceholder('Select action to take on raiders')
                .addOptions([
                    {
                        label: 'Kick Raiders',
                        description: 'Kick suspicious new members',
                        value: 'kick',
                        emoji: '👢',
                        default: config.action === 'kick'
                    },
                    {
                        label: 'Ban Raiders',
                        description: 'Ban suspicious new members',
                        value: 'ban',
                        emoji: '🔨',
                        default: config.action === 'ban'
                    },
                    {
                        label: 'Monitor Only',
                        description: 'Just notify, take no action',
                        value: 'none',
                        emoji: '👁️',
                        default: config.action === 'none'
                    }
                ]);
            
            const row = new ActionRowBuilder().addComponents(actionMenu);
            await interaction.reply({ 
                content: '⚡ Select the action to take when a raid is detected:', 
                components: [row], 
                ephemeral: true 
            });
        } else if (interaction.customId === 'raid_set_lockdown') {
            const modal = new ModalBuilder()
                .setCustomId('raid_lockdown_modal')
                .setTitle('Set Lockdown Duration');
            
            const durationInput = new TextInputBuilder()
                .setCustomId('duration_value')
                .setLabel('Duration (0=manual, 1-3600 seconds)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('300')
                .setValue(config.lockdownDuration.toString())
                .setRequired(true)
                .setMaxLength(4);
            
            modal.addComponents(new ActionRowBuilder().addComponents(durationInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'raid_set_notification') {
            const modal = new ModalBuilder()
                .setCustomId('raid_notification_modal')
                .setTitle('Set Notification Channel');
            
            const channelInput = new TextInputBuilder()
                .setCustomId('channel_id')
                .setLabel('Channel ID or #mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('#raid-alerts or channel ID')
                .setValue(config.notificationChannel || '')
                .setRequired(true)
                .setMaxLength(100);
            
            modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
            await interaction.showModal(modal);
        } else if (interaction.customId === 'raid_whitelist') {
            const modal = new ModalBuilder()
                .setCustomId('raid_whitelist_modal')
                .setTitle('Manage Whitelist');
            
            const actionInput = new TextInputBuilder()
                .setCustomId('whitelist_action')
                .setLabel('Add or Remove? (type: add or remove)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('add')
                .setRequired(true)
                .setMaxLength(10);
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or @mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true)
                .setMaxLength(100);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(actionInput),
                new ActionRowBuilder().addComponents(userInput)
            );
            await interaction.showModal(modal);
        } else if (interaction.customId === 'raid_unlock') {
            if (!lockedServers.has(interaction.guild.id)) {
                return interaction.reply({ 
                    content: '❌ Server is not in lockdown mode!', 
                    ephemeral: true 
                });
            }
            
            lockedServers.delete(interaction.guild.id);
            const timer = lockdownTimers.get(interaction.guild.id);
            if (timer) {
                clearTimeout(timer);
                lockdownTimers.delete(interaction.guild.id);
            }
            
            await interaction.reply({ 
                content: '🔓 **Lockdown lifted!** Server is now accepting new members.', 
                ephemeral: true 
            });
        } else if (interaction.customId === 'raid_refresh') {
            const whitelistUsers = config.whitelist.length > 0
                ? config.whitelist.map(id => `<@${id}>`).join(', ')
                : 'None';
            const notifChannel = config.notificationChannel ? `<#${config.notificationChannel}>` : 'Not set';
            const lockdownStatus = lockedServers.has(interaction.guild.id) ? '🔒 Active' : '🔓 None';
            const actionText = config.action === 'none' ? 'Monitor Only' : config.action === 'kick' ? 'Kick' : 'Ban';
            
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Raid Protection Control Panel')
                .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
                .setDescription(
                    `System is currently **${config.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                    `Monitors for suspicious join patterns and takes automatic action.\n\n` +
                    `Click the buttons below to configure settings.`
                )
                .addFields(
                    { name: '📡 Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                    { name: '👥 Join Threshold', value: `${config.joinThreshold} members`, inline: true },
                    { name: '⏱️ Time Window', value: `${config.timeWindow} seconds`, inline: true },
                    { name: '⚡ Action', value: actionText, inline: true },
                    { name: '🔒 Lockdown Duration', value: config.lockdownDuration === 0 ? 'Manual unlock' : `${config.lockdownDuration}s`, inline: true },
                    { name: '🔓 Current Lockdown', value: lockdownStatus, inline: true },
                    { name: '📢 Notification Channel', value: notifChannel, inline: true },
                    { name: '✅ Whitelisted Users', value: whitelistUsers.length > 100 ? whitelistUsers.substring(0, 100) + '...' : whitelistUsers, inline: true }
                )
                .setFooter({ text: 'Click buttons below to configure raid protection' })
                .setTimestamp();
            
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('raid_toggle')
                        .setLabel(config.enabled ? 'Disable' : 'Enable')
                        .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                        .setEmoji(config.enabled ? '⏸️' : '▶️'),
                    new ButtonBuilder()
                        .setCustomId('raid_set_threshold')
                        .setLabel('Set Threshold')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👥'),
                    new ButtonBuilder()
                        .setCustomId('raid_set_timewindow')
                        .setLabel('Time Window')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⏱️'),
                    new ButtonBuilder()
                        .setCustomId('raid_set_action')
                        .setLabel('Set Action')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚡')
                );
            
            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('raid_set_lockdown')
                        .setLabel('Lockdown Duration')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId('raid_set_notification')
                        .setLabel('Notification Channel')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📢'),
                    new ButtonBuilder()
                        .setCustomId('raid_whitelist')
                        .setLabel('Manage Whitelist')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('raid_refresh')
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );
            
            const row3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('raid_unlock')
                        .setLabel('Unlock Server')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔓')
                        .setDisabled(!lockedServers.has(interaction.guild.id))
                );
            
            await interaction.update({ embeds: [embed], components: [row1, row2, row3] });
        }
    }
    
    // Raid action select menu handler
    if (interaction.isStringSelectMenu() && interaction.customId === 'raid_action_select') {
        const settings = getGuildSettings(guildId);
        const action = interaction.values[0];
        settings.raidProtection.action = action;
        saveSettings();
        
        const actionText = action === 'none' ? 'Monitor only (no action)' : action === 'kick' ? 'Kick raiders' : 'Ban raiders';
        await interaction.update({ content: `✅ Raid action set to: **${actionText}**`, components: [] });
        return;
    }
    
    // Game button handlers
    if (interaction.customId.startsWith('game_')) {
        const gameType = interaction.customId.replace('game_', '');
        
        try {
            if (gameType === 'snake') {
                const game = new Snake({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🐍 Snake Game',
                        overTitle: '💀 Game Over',
                        color: '#5865F2'
                    },
                    emojis: {
                        board: '⬛',
                        food: '🍎',
                        up: '⬆️', 
                        down: '⬇️',
                        left: '⬅️',
                        right: '➡️',
                    },
                    snake: { head: '🟢', body: '🟩', tail: '🟢', over: '☠️' },
                    foods: ['🍎', '🍇', '🍊', '🫐', '🥕', '🥝', '🌽'],
                    stopButton: 'Stop',
                    timeoutTime: 60000,
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'tictactoe') {
                await interaction.reply({ 
                    content: '⭕ **Tic-Tac-Toe** requires an opponent! Please mention a user to play with:', 
                    ephemeral: true 
                });
                
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                    .catch(() => null);
                
                if (!collected) {
                    return interaction.followUp({ content: '❌ Timed out waiting for opponent mention.', ephemeral: true });
                }
                
                const opponent = collected.first().mentions.users.first();
                if (!opponent) {
                    return interaction.followUp({ content: '❌ Please mention a valid user!', ephemeral: true });
                }
                
                if (opponent.bot) {
                    return interaction.followUp({ content: '❌ You cannot play against bots!', ephemeral: true });
                }
                
                if (opponent.id === interaction.user.id) {
                    return interaction.followUp({ content: '❌ You cannot play against yourself!', ephemeral: true });
                }
                
                await collected.first().delete().catch(() => {});
                
                const game = new TicTacToe({
                    message: collected.first(),
                    isSlashGame: false,
                    opponent: opponent,
                    embed: {
                        title: '⭕ Tic Tac Toe',
                        color: '#5865F2',
                        statusTitle: 'Status',
                        overTitle: 'Game Over'
                    },
                    emojis: {
                        xButton: '❌',
                        oButton: '⭕',
                        blankButton: '➖'
                    },
                    mentionUser: true,
                    timeoutTime: 60000,
                    xButtonStyle: 'DANGER',
                    oButtonStyle: 'PRIMARY',
                    turnMessage: '{emoji} | It\'s **{player}**\'s turn.',
                    winMessage: '{emoji} | **{player}** won the TicTacToe Game!',
                    tieMessage: 'The Game tied! No one won the Game!',
                    timeoutMessage: 'The Game went unfinished! No one won the Game!',
                    playerOnlyMessage: 'Only {player} and {opponent} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'connect4') {
                await interaction.reply({ 
                    content: '🔴 **Connect 4** requires an opponent! Please mention a user to play with:', 
                    ephemeral: true 
                });
                
                const filter = m => m.author.id === interaction.user.id;
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] })
                    .catch(() => null);
                
                if (!collected) {
                    return interaction.followUp({ content: '❌ Timed out waiting for opponent mention.', ephemeral: true });
                }
                
                const opponent = collected.first().mentions.users.first();
                if (!opponent) {
                    return interaction.followUp({ content: '❌ Please mention a valid user!', ephemeral: true });
                }
                
                if (opponent.bot) {
                    return interaction.followUp({ content: '❌ You cannot play against bots!', ephemeral: true });
                }
                
                if (opponent.id === interaction.user.id) {
                    return interaction.followUp({ content: '❌ You cannot play against yourself!', ephemeral: true });
                }
                
                await collected.first().delete().catch(() => {});
                
                const game = new Connect4({
                    message: collected.first(),
                    isSlashGame: false,
                    opponent: opponent,
                    embed: {
                        title: '🔴 Connect 4',
                        statusTitle: 'Status',
                        color: '#5865F2'
                    },
                    emojis: {
                        board: '⚫',
                        player1: '🔴',
                        player2: '🟡'
                    },
                    mentionUser: true,
                    timeoutTime: 60000,
                    buttonStyle: 'PRIMARY',
                    turnMessage: '{emoji} | It\'s **{player}**\'s turn.',
                    winMessage: '{emoji} | **{player}** won the Connect4 Game!',
                    tieMessage: 'The Game tied! No one won the Game!',
                    timeoutMessage: 'The Game went unfinished! No one won the Game!',
                    playerOnlyMessage: 'Only {player} and {opponent} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'wordle') {
                const game = new Wordle({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '📝 Wordle',
                        color: '#5865F2'
                    },
                    customWord: null,
                    timeoutTime: 60000,
                    winMessage: '🎉 You won! The word was **{word}**.',
                    loseMessage: '😢 You lost! The word was **{word}**.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'minesweeper') {
                const game = new Minesweeper({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '💣 Minesweeper',
                        color: '#5865F2',
                        description: 'Click on the buttons to reveal the blocks except mines.'
                    },
                    emojis: { flag: '🚩', mine: '💣' },
                    mines: 5,
                    timeoutTime: 60000,
                    winMessage: '🎉 You won the Game! You successfully avoided all the mines.',
                    loseMessage: '💥 You lost the Game! Beware of the mines next time.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === '2048') {
                const game = new TwoZeroFourEight({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🔢 2048',
                        color: '#5865F2'
                    },
                    emojis: {
                        up: '⬆️',
                        down: '⬇️',
                        left: '⬅️',
                        right: '➡️',
                    },
                    timeoutTime: 60000,
                    buttonStyle: 'PRIMARY',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'memory') {
                const game = new MatchPairs({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🧠 Memory Game',
                        color: '#5865F2',
                        description: '**Click on the buttons to match the emojis.**'
                    },
                    timeoutTime: 60000,
                    emojis: ['🍉', '🍇', '🍊', '🍋', '🥭', '🍎', '🍏', '🥝'],
                    winMessage: '🎉 You won! You matched all the pairs in **{tilesTurned}** turns.',
                    loseMessage: '😢 You lost! You ran out of time.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'fasttype') {
                const game = new FastType({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '⏱️ Fast Type',
                        color: '#5865F2',
                        description: 'You have **{time}** seconds to type the sentence below.'
                    },
                    timeoutTime: 60000,
                    sentence: 'The quick brown fox jumps over the lazy dog.',
                    winMessage: '🎉 You won! You finished in **{time}** seconds with **{wpm}** WPM.',
                    loseMessage: '😢 You lost! You ran out of time.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'findemoji') {
                const game = new FindEmoji({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🔍 Find Emoji',
                        color: '#5865F2',
                        description: 'Find the **{emoji}** emoji in the grid below.'
                    },
                    timeoutTime: 60000,
                    hideEmojiTime: 5000,
                    buttonStyle: 'PRIMARY',
                    emojis: ['🍉', '🍇', '🍊', '🍋', '🥭', '🍎', '🍏', '🥝'],
                    winMessage: '🎉 You won! You found the emoji in **{time}** seconds.',
                    loseMessage: '😢 You lost! You ran out of time.',
                    timeoutMessage: '⏱️ You ran out of time! The emoji was **{emoji}**.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'guesspokemon') {
                const game = new GuessThePokemon({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🎮 Guess The Pokémon',
                        color: '#5865F2'
                    },
                    timeoutTime: 60000,
                    winMessage: '🎉 You guessed it right! It was **{pokemon}**.',
                    loseMessage: '😢 Better luck next time! It was **{pokemon}**.',
                    errMessage: '❌ Unable to fetch Pokémon data! Please try again.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'rps') {
                const game = new RockPaperScissors({
                    message: interaction,
                    isSlashGame: false,
                    opponent: interaction.user,
                    embed: {
                        title: '🪨 Rock Paper Scissors',
                        color: '#5865F2',
                        description: 'Press a button below to make your choice.'
                    },
                    buttons: {
                        rock: 'Rock',
                        paper: 'Paper',
                        scissors: 'Scissors'
                    },
                    emojis: {
                        rock: '🪨',
                        paper: '📄',
                        scissors: '✂️'
                    },
                    mentionUser: true,
                    timeoutTime: 60000,
                    buttonStyle: 'PRIMARY',
                    pickMessage: 'You choose **{emoji}**.',
                    winMessage: '**{player}** won the Game! Congratulations!',
                    tieMessage: 'The Game tied! No one won the Game!',
                    timeoutMessage: 'The Game went unfinished! No one won the Game!',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'hangman') {
                const game = new Hangman({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🎮 Hangman',
                        color: '#5865F2'
                    },
                    hangman: { hat: '🎩', head: '😟', shirt: '👕', pants: '🩳', boots: '👞👞' },
                    customWord: null,
                    timeoutTime: 60000,
                    theme: 'nature',
                    winMessage: '🎉 You won! The word was **{word}**.',
                    loseMessage: '😢 You lost! The word was **{word}**.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'trivia') {
                const game = new Trivia({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🧠 Trivia',
                        color: '#5865F2',
                        description: 'You have **60 seconds** to answer the question.'
                    },
                    timeoutTime: 60000,
                    buttonStyle: 'PRIMARY',
                    mode: 'multiple',
                    difficulty: 'medium',
                    winMessage: '🎉 You got it right! The answer was **{answer}**.',
                    loseMessage: '😢 You got it wrong! The answer was **{answer}**.',
                    errMessage: '❌ Unable to fetch question data! Please try again.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'slots') {
                const game = new Slots({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🎰 Slot Machine',
                        color: '#5865F2'
                    },
                    slots: ['🍇', '🍊', '🍋', '🍌']
                });
                
                await game.startGame();
            }
            
            else if (gameType === 'wouldyourather') {
                const game = new WouldYouRather({
                    message: interaction,
                    isSlashGame: false,
                    embed: {
                        title: '🤔 Would You Rather',
                        color: '#5865F2'
                    },
                    buttons: {
                        option1: 'Option 1',
                        option2: 'Option 2'
                    },
                    timeoutTime: 60000,
                    errMessage: '❌ Unable to fetch question data! Please try again.',
                    playerOnlyMessage: 'Only {player} can use these buttons.'
                });
                
                await game.startGame();
            }
            
        } catch (error) {
            console.error('Error starting game:', error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ An error occurred while starting the game. Please try again!', 
                    ephemeral: true 
                });
            }
        }
        
        return;
    }
    
    // Claim ticket button
    // Claim ticket button (Staff only)
    if (interaction.customId.startsWith('claim_ticket_')) {
        const channelId = interaction.customId.replace('claim_ticket_', '');
        const ticketInfo = ticketData[guildId].tickets[channelId];
        
        if (!ticketInfo) {
            return interaction.reply({ content: '❌ Ticket not found!', ephemeral: true });
        }
        
        // Check if user is staff/admin
        const hasStaffRole = ticketData[guildId].settings.staffRoleId && 
            interaction.member.roles.cache.has(ticketData[guildId].settings.staffRoleId);
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && 
            !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
            !hasStaffRole) {
            return interaction.reply({ 
                content: '❌ You need to be a staff member, administrator, or have Manage Channels permission to claim tickets!', 
                ephemeral: true 
            });
        }
        
        if (ticketInfo.claimed) {
            return interaction.reply({ 
                content: `❌ This ticket is already claimed by <@${ticketInfo.claimedBy}>!`, 
                ephemeral: true 
            });
        }
        
        ticketInfo.claimed = true;
        ticketInfo.claimedBy = interaction.user.id;
        ticketInfo.claimedAt = Date.now();
        saveTicketData();
        
        const claimEmbed = new EmbedBuilder()
            .setTitle('✋ Ticket Claimed')
            .setDescription(`${interaction.user} has claimed this ticket and will assist you.`)
            .setColor(0xFFA500)
            .setTimestamp();
        
        await interaction.reply({ embeds: [claimEmbed] });
    }
    
    // Close ticket button - shows confirmation
    if (interaction.customId.startsWith('close_ticket_')) {
        const channelId = interaction.customId.replace('close_ticket_', '');
        const ticketInfo = ticketData[guildId].tickets[channelId];
        
        if (!ticketInfo) {
            return interaction.reply({ content: '❌ Ticket not found!', ephemeral: true });
        }
        
        if (ticketInfo.status === 'closed') {
            return interaction.reply({ content: '❌ This ticket is already closed!', ephemeral: true });
        }
        
        // Check if user is staff/admin
        const hasStaffRole = ticketData[guildId].settings.staffRoleId && 
            interaction.member.roles.cache.has(ticketData[guildId].settings.staffRoleId);
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                        hasStaffRole;
        
        // Create confirmation buttons
        const confirmRow = new ActionRowBuilder();
        
        if (isStaff) {
            // Staff gets transcript option
            confirmRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_close_transcript_${channelId}`)
                    .setLabel('Close with Transcript')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📄'),
                new ButtonBuilder()
                    .setCustomId(`confirm_close_no_transcript_${channelId}`)
                    .setLabel('Close without Transcript')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.reply({ 
                content: '📋 Do you want to save a transcript before closing?',
                components: [confirmRow],
                ephemeral: true
            });
        } else {
            // Regular members just confirm close
            confirmRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_close_no_transcript_${channelId}`)
                    .setLabel('Confirm Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.reply({ 
                content: '⚠️ Are you sure you want to close this ticket?',
                components: [confirmRow],
                ephemeral: true
            });
        }
    }
    
    // Confirm close with transcript
    if (interaction.customId.startsWith('confirm_close_transcript_')) {
        const channelId = interaction.customId.replace('confirm_close_transcript_', '');
        const ticketInfo = ticketData[guildId].tickets[channelId];
        
        if (!ticketInfo) {
            return interaction.update({ content: '❌ Ticket not found!', components: [] });
        }
        
        ticketInfo.status = 'closed';
        ticketInfo.closedBy = interaction.user.id;
        ticketInfo.closedAt = Date.now();
        saveTicketData();
        
        await interaction.update({ 
            content: '✅ Closing ticket with transcript and sending DM...', 
            components: [] 
        });
        
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(
                `**Closed by:** ${interaction.user}\n` +
                `**Status:** 📄 Transcript saved\n\n` +
                `⏱️ Channel will be deleted in 5 seconds...`
            )
            .setColor(0xFF0000)
            .setFooter({ text: 'Thank you for using our support system!' })
            .setTimestamp();
        
        await interaction.channel.send({ embeds: [closeEmbed] });
        
        // Send DM with transcript
        try {
            const creator = await client.users.fetch(ticketInfo.creator);
            const closedBy = await client.users.fetch(ticketInfo.closedBy);
            
            const closedMessage = ticketData[guildId].settings?.closedMessage || 
                'Thank you for contacting support! 🙏\n\nIf you need additional assistance, feel free to open a new ticket by clicking the button on the ticket panel!';
            
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Closed')
                .setDescription(
                    `Your ticket **#${ticketInfo.number}** in **${interaction.guild.name}** has been closed.\n\n` +
                    `**📝 Original Reason:** ${ticketInfo.reason}\n` +
                    `**🔒 Closed by:** ${closedBy.tag}\n` +
                    `**📅 Closed at:** <t:${Math.floor(ticketInfo.closedAt / 1000)}:F>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    closedMessage
                )
                .setColor(0x3498DB)
                .setFooter({ text: `${interaction.guild.name} Support System` })
                .setTimestamp();
            
            const transcript = await generateTranscript(interaction.channel);
            if (transcript) {
                const transcriptBuffer = Buffer.from(transcript, 'utf-8');
                
                await creator.send({
                    embeds: [dmEmbed],
                    files: [{
                        attachment: transcriptBuffer,
                        name: `ticket-${ticketInfo.number}-transcript.txt`
                    }]
                });
            } else {
                await creator.send({ embeds: [dmEmbed] });
            }
        } catch (error) {
            console.error('Error sending DM:', error);
        }
        
        // Delete channel after 5 seconds
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                delete ticketData[guildId].tickets[channelId];
                saveTicketData();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    }
    
    // Confirm close without transcript
    if (interaction.customId.startsWith('confirm_close_no_transcript_')) {
        const channelId = interaction.customId.replace('confirm_close_no_transcript_', '');
        const ticketInfo = ticketData[guildId].tickets[channelId];
        
        if (!ticketInfo) {
            return interaction.update({ content: '❌ Ticket not found!', components: [] });
        }
        
        ticketInfo.status = 'closed';
        ticketInfo.closedBy = interaction.user.id;
        ticketInfo.closedAt = Date.now();
        saveTicketData();
        
        await interaction.update({ 
            content: '✅ Closing ticket and sending DM...', 
            components: [] 
        });
        
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(
                `**Closed by:** ${interaction.user}\n` +
                `**Status:** 🗑️ No transcript saved\n\n` +
                `⏱️ Channel will be deleted in 5 seconds...`
            )
            .setColor(0xFF0000)
            .setFooter({ text: 'Thank you for using our support system!' })
            .setTimestamp();
        
        await interaction.channel.send({ embeds: [closeEmbed] });
        
        // Send DM without transcript
        try {
            const creator = await client.users.fetch(ticketInfo.creator);
            const closedBy = await client.users.fetch(ticketInfo.closedBy);
            
            const closedMessage = ticketData[guildId].settings?.closedMessage || 
                'Thank you for contacting support! 🙏\n\nIf you need additional assistance, feel free to open a new ticket by clicking the button on the ticket panel!';
            
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎫 Ticket Closed')
                .setDescription(
                    `Your ticket **#${ticketInfo.number}** in **${interaction.guild.name}** has been closed.\n\n` +
                    `**📝 Original Reason:** ${ticketInfo.reason}\n` +
                    `**🔒 Closed by:** ${closedBy.tag}\n` +
                    `**📅 Closed at:** <t:${Math.floor(ticketInfo.closedAt / 1000)}:F>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    closedMessage
                )
                .setColor(0x3498DB)
                .setFooter({ text: `${interaction.guild.name} Support System` })
                .setTimestamp();
            
            await creator.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.error('Error sending DM:', error);
        }
        
        // Delete channel after 5 seconds
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                delete ticketData[guildId].tickets[channelId];
                saveTicketData();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    }
    
    // Cancel close
    if (interaction.customId === 'cancel_close') {
        await interaction.update({ 
            content: '❌ Ticket close cancelled.', 
            components: [] 
        });
    }
    
    // Create ticket from panel button
    if (interaction.customId === 'create_ticket_panel') {
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        
        // Check if ticket system is enabled
        if (!ticketData[guildId].settings.enabled) {
            return interaction.reply({ 
                content: '❌ The ticket system is not enabled. Please contact an administrator!', 
                ephemeral: true 
            });
        }
        
        // Increment ticket counter
        ticketData[guildId].counter++;
        const ticketNumber = ticketData[guildId].counter;
        const ticketName = `ticket-${ticketNumber}`;
        
        try {
            // Find or create ticket category
            const categoryName = ticketData[guildId].settings.categoryName || '🎫 Tickets';
            let category = interaction.guild.channels.cache.get(ticketData[guildId].categoryId);
            if (!category || category.type !== ChannelType.GuildCategory) {
                category = await interaction.guild.channels.create({
                    name: categoryName,
                    type: ChannelType.GuildCategory
                });
                ticketData[guildId].categoryId = category.id;
                saveTicketData();
            }
            
            // Create permission overwrites
            const permissionOverwrites = [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }
            ];
            
            // Add staff role if configured
            if (ticketData[guildId].settings.staffRoleId) {
                permissionOverwrites.push({
                    id: ticketData[guildId].settings.staffRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                });
            }
            
            // Create ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: permissionOverwrites
            });
            
            // Store ticket info
            ticketData[guildId].tickets[ticketChannel.id] = {
                number: ticketNumber,
                creator: interaction.user.id,
                createdAt: Date.now(),
                claimed: false,
                claimedBy: null,
                status: 'open',
                reason: 'Created from panel'
            };
            saveTicketData();
            
            // Create interactive ticket embed with custom message
            const customMessage = ticketData[guildId].settings.ticketMessage || 
                '**Welcome to your support ticket!**\n\n🎫 Our support team will be with you shortly.\n\n**Please describe your issue in detail.**';
            
            const ticketEmbed = new EmbedBuilder()
                .setTitle(`🎫 Support Ticket #${ticketNumber}`)
                .setDescription(
                    `**👤 Created by:** ${interaction.user}\n` +
                    `**📅 Created at:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `**🔔 Status:** 🟢 Open\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    customMessage
                )
                .setColor(0x00FF00)
                .setFooter({ text: `Ticket System • ${interaction.guild.name}` })
                .setTimestamp();
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`claim_ticket_${ticketChannel.id}`)
                        .setLabel('Claim Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✋'),
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({ 
                content: `${interaction.user} **|** Staff will assist you soon!`,
                embeds: [ticketEmbed], 
                components: [row] 
            });
            
            // Send confirmation to user
            await interaction.reply({ 
                content: `✅ Your ticket has been created! ${ticketChannel}`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while creating the ticket. Please try again or contact an administrator.', 
                ephemeral: true 
            });
        }
    }
        } // End button handling
    
        // Handle modal submissions
        else if (interaction.isModalSubmit()) {
            // YouTube modal handlers
            if (interaction.customId.includes('yt_')) {
                try {
                    delete require.cache[require.resolve('./commands/youtubenotifications.js')];
                    const ytCommand = require('./commands/youtubenotifications.js');
                    await ytCommand.handleModal(interaction);
                    return;
                } catch (error) {
                    console.error('❌ YouTube modal error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }
            
            // Logging system modal handlers
            if (interaction.customId.startsWith('log_modal_')) {
                const guildId = interaction.guild.id;
                
                // Check admin permissions
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions to use this command!', 
                        ephemeral: true 
                    });
                }
                
                try {
                    const logType = interaction.customId.replace('log_modal_', '');
                    const channelInput = interaction.fields.getTextInputValue('channel_id');
                    
                    // Extract channel ID from mention or plain ID
                    const channelMatch = channelInput.match(/(\d{17,19})/);
                    if (!channelMatch) {
                        return interaction.reply({ 
                            content: '❌ Invalid channel ID or mention. Please try again.', 
                            ephemeral: true 
                        });
                    }
                    
                    const channelId = channelMatch[1];
                    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                    
                    if (!channel || !channel.isTextBased()) {
                        return interaction.reply({ 
                            content: '❌ Channel not found or is not a text channel!', 
                            ephemeral: true 
                        });
                    }
                    
                    const settings = getGuildSettings(interaction.guild.id);
                    settings.logging.channels[logType] = channelId;
                    settings.logging.enabled = true;
                    saveSettings();
                    
                    const typeNames = {
                        critical: '🔴 Critical Errors',
                        moderation: '⚖️ Moderation Actions',
                        messages: '💬 Message Events',
                        members: '👥 Member Events',
                        voice: '🔊 Voice Activity',
                        server: '🛠️ Server Changes',
                        keywords: '🚨 Keyword Flags'
                    };
                    
                    await interaction.reply({ 
                        content: `✅ ${typeNames[logType]} channel set to ${channel}!`, 
                        ephemeral: true 
                    });
                    
                    // Send test message
                    const testEmbed = new EmbedBuilder()
                        .setTitle(`✅ ${typeNames[logType]} Logging Configured`)
                        .setDescription(`This channel will receive ${typeNames[logType].toLowerCase()}.`)
                        .setColor(0x00FF00)
                        .setTimestamp();
                    
                    await channel.send({ embeds: [testEmbed] }).catch(() => {});
                    
                } catch (error) {
                    console.error('❌ Log modal error:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                }
                return;
            }
            
            // AI system modal handlers
            if (interaction.customId.startsWith('ai_')) {
                const guildId = interaction.guild.id;
                
                // Check admin permissions
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions to use this command!', 
                        ephemeral: true 
                    });
                }
                
                try {
                    const settings = getGuildSettings(guildId);
                    if (!settings.ai) {
                        settings.ai = defaultSettings.ai;
                    }
                    
                    if (interaction.customId === 'ai_channel_modal') {
                        const channelName = interaction.fields.getTextInputValue('channel_name').trim();
                        
                        // Remove # if user included it
                        const cleanChannelName = channelName.replace(/^#/, '');
                        
                        settings.ai.channelName = cleanChannelName;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ AI channel set to **#${cleanChannelName}**! ${settings.ai.enabled ? 'AI will respond there automatically.' : 'Enable AI to start using it.'}`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'ai_history_modal') {
                        const historyStr = interaction.fields.getTextInputValue('max_history').trim();
                        const history = parseInt(historyStr);
                        
                        if (isNaN(history) || history < 1 || history > 50) {
                            return interaction.reply({ 
                                content: '❌ Invalid number! Must be between 1-50.', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.ai.maxHistory = history;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Max history set to **${history} exchanges**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'ai_temperature_modal') {
                        const tempStr = interaction.fields.getTextInputValue('temperature').trim();
                        const temperature = parseFloat(tempStr);
                        
                        if (isNaN(temperature) || temperature < 0 || temperature > 2) {
                            return interaction.reply({ 
                                content: '❌ Invalid temperature! Must be between 0.0-2.0.', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.ai.temperature = temperature;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Temperature set to **${temperature}**! ${temperature < 0.3 ? '(Very focused)' : temperature < 0.7 ? '(Balanced)' : temperature < 1.0 ? '(Creative)' : '(Very creative)'}`, 
                            ephemeral: true 
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ [AI MODAL] Error:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                }
                return;
            }
            
            // Moderation system modal handlers
            if (interaction.customId.startsWith('mod_')) {
                const guildId = interaction.guild.id;
                
                // Check admin permissions
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions to use this command!', 
                        ephemeral: true 
                    });
                }
                
                try {
                    const settings = getGuildSettings(guildId);
                    if (!settings.moderation) {
                        settings.moderation = defaultSettings.moderation;
                    }
                    
                    if (interaction.customId === 'mod_threshold_modal') {
                        const thresholdStr = interaction.fields.getTextInputValue('threshold').trim();
                        const threshold = parseInt(thresholdStr);
                        
                        if (isNaN(threshold) || threshold < 1 || threshold > 20) {
                            return interaction.reply({ 
                                content: '❌ Invalid number! Must be between 1-20.', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.warningThreshold = threshold;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Threshold set to **${threshold} warnings**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_timeout_modal') {
                        const durationStr = interaction.fields.getTextInputValue('duration').trim();
                        const minutes = parseInt(durationStr);
                        
                        if (isNaN(minutes) || minutes < 1 || minutes > 40320) {
                            return interaction.reply({ 
                                content: '❌ Invalid duration! Must be between 1-40320 minutes.', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.timeoutDuration = minutes * 60;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Timeout duration set to **${minutes} minutes**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_decay_modal') {
                        const decayStr = interaction.fields.getTextInputValue('decay').trim();
                        const days = parseInt(decayStr);
                        
                        if (isNaN(days) || days < 0 || days > 365) {
                            return interaction.reply({ 
                                content: '❌ Invalid number! Must be between 0-365.', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.warningDecay = days;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: days === 0 ? '✅ Warnings will never expire!' : `✅ Warnings will expire after **${days} days**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_logchannel_modal') {
                        const channelInput = interaction.fields.getTextInputValue('channel_id').trim();
                        
                        const channelMatch = channelInput.match(/(\d{17,19})/);
                        if (!channelMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid channel ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const channelId = channelMatch[1];
                        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                        
                        if (!channel || !channel.isTextBased()) {
                            return interaction.reply({ 
                                content: '❌ Channel not found or is not a text channel!', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.modLogChannel = channelId;
                        saveSettings();
                        
                        const testEmbed = new EmbedBuilder()
                            .setTitle('✅ Moderation Log Channel Configured')
                            .setDescription('This channel will receive moderation logs.')
                            .setColor(0x00FF00)
                            .setTimestamp();
                        
                        await channel.send({ embeds: [testEmbed] }).catch(() => {});
                        
                        await interaction.reply({ 
                            content: `✅ Log channel set to ${channel}!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_muterole_modal') {
                        const roleInput = interaction.fields.getTextInputValue('role_id').trim();
                        
                        const roleMatch = roleInput.match(/(\d{17,19})/);
                        if (!roleMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const roleId = roleMatch[1];
                        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                        
                        if (!role) {
                            return interaction.reply({ 
                                content: '❌ Role not found!', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.muteRole = roleId;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Mute role set to ${role}!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_addrole_modal') {
                        const roleInput = interaction.fields.getTextInputValue('role_id').trim();
                        
                        const roleMatch = roleInput.match(/(\d{17,19})/);
                        if (!roleMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const roleId = roleMatch[1];
                        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                        
                        if (!role) {
                            return interaction.reply({ 
                                content: '❌ Role not found!', 
                                ephemeral: true 
                            });
                        }
                        
                        if (settings.moderation.moderatorRoles.includes(roleId)) {
                            return interaction.reply({ 
                                content: '❌ This role is already a moderator role!', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.moderatorRoles.push(roleId);
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ ${role} added as moderator role!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'mod_removerole_modal') {
                        const roleInput = interaction.fields.getTextInputValue('role_id').trim();
                        
                        const roleMatch = roleInput.match(/(\d{17,19})/);
                        if (!roleMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const roleId = roleMatch[1];
                        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                        
                        const index = settings.moderation.moderatorRoles.indexOf(roleId);
                        if (index === -1) {
                            return interaction.reply({ 
                                content: '❌ This role is not a moderator role!', 
                                ephemeral: true 
                            });
                        }
                        
                        settings.moderation.moderatorRoles.splice(index, 1);
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ ${role ? role : 'Role'} removed from moderator roles!`, 
                            ephemeral: true 
                        });
                    }
                    
                    // Welcome system modals
                    else if (interaction.customId === 'welcome_channel_modal') {
                        const channelName = interaction.fields.getTextInputValue('channel_name').trim();
                        settings.welcome.channelName = channelName;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Welcome channel set to **#${channelName}**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'welcome_message_modal') {
                        const messageText = interaction.fields.getTextInputValue('message_text').trim();
                        settings.welcome.customMessage = messageText;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Welcome message updated!\n\n**Preview:**\n${messageText.substring(0, 200)}`, 
                            ephemeral: true 
                        });
                    }
                    
                    // Leave system modals
                    else if (interaction.customId === 'leave_channel_modal') {
                        const channelName = interaction.fields.getTextInputValue('channel_name').trim();
                        settings.leave.channelName = channelName;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Leave channel set to **#${channelName}**!`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'leave_message_modal') {
                        const messageText = interaction.fields.getTextInputValue('message_text').trim();
                        settings.leave.customMessage = messageText;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Leave message updated!\n\n**Preview:**\n${messageText.substring(0, 200)}`, 
                            ephemeral: true 
                        });
                    }
                    
                    // Auto-nickname modals
                    else if (interaction.customId === 'autonick_prefix_modal') {
                        const prefixText = interaction.fields.getTextInputValue('prefix_text').trim();
                        if (!settings.autoNickname) {
                            settings.autoNickname = { enabled: false, prefix: '', suffix: '' };
                        }
                        settings.autoNickname.prefix = prefixText;
                        saveSettings();
                        
                        const example = `${prefixText}Username${settings.autoNickname.suffix || ''}`;
                        await interaction.reply({ 
                            content: `✅ Nickname prefix set to **"${prefixText}"**!\n\n**Example:** \`Username\` → \`${example}\``, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'autonick_suffix_modal') {
                        const suffixText = interaction.fields.getTextInputValue('suffix_text').trim();
                        if (!settings.autoNickname) {
                            settings.autoNickname = { enabled: false, prefix: '', suffix: '' };
                        }
                        settings.autoNickname.suffix = suffixText;
                        saveSettings();
                        
                        const example = `${settings.autoNickname.prefix || ''}Username${suffixText}`;
                        await interaction.reply({ 
                            content: `✅ Nickname suffix set to **"${suffixText}"**!\n\n**Example:** \`Username\` → \`${example}\``, 
                            ephemeral: true 
                        });
                    }
                    
                    // Raid protection modals
                    else if (interaction.customId === 'raid_threshold_modal') {
                        const thresholdValue = parseInt(interaction.fields.getTextInputValue('threshold_value').trim());
                        
                        if (isNaN(thresholdValue) || thresholdValue < 2 || thresholdValue > 50) {
                            return interaction.reply({ 
                                content: '❌ Invalid threshold! Please enter a number between 2 and 50.', 
                                ephemeral: true 
                            });
                        }
                        
                        if (!settings.raidProtection) {
                            settings.raidProtection = { enabled: false, joinThreshold: 5, timeWindow: 10, action: 'kick', whitelist: [], notificationChannel: null, lockdownDuration: 300 };
                        }
                        settings.raidProtection.joinThreshold = thresholdValue;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Join threshold set to **${thresholdValue} members**!\n\nRaid detection will trigger when ${thresholdValue} members join within ${settings.raidProtection.timeWindow} seconds.`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'raid_timewindow_modal') {
                        const timeValue = parseInt(interaction.fields.getTextInputValue('time_value').trim());
                        
                        if (isNaN(timeValue) || timeValue < 5 || timeValue > 300) {
                            return interaction.reply({ 
                                content: '❌ Invalid time window! Please enter a number between 5 and 300 seconds.', 
                                ephemeral: true 
                            });
                        }
                        
                        if (!settings.raidProtection) {
                            settings.raidProtection = { enabled: false, joinThreshold: 5, timeWindow: 10, action: 'kick', whitelist: [], notificationChannel: null, lockdownDuration: 300 };
                        }
                        settings.raidProtection.timeWindow = timeValue;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Time window set to **${timeValue} seconds**!\n\nRaid detection will trigger when ${settings.raidProtection.joinThreshold} members join within ${timeValue} seconds.`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'raid_lockdown_modal') {
                        const durationValue = parseInt(interaction.fields.getTextInputValue('duration_value').trim());
                        
                        if (isNaN(durationValue) || durationValue < 0 || durationValue > 3600) {
                            return interaction.reply({ 
                                content: '❌ Invalid duration! Please enter a number between 0 and 3600 seconds (0 = manual unlock).', 
                                ephemeral: true 
                            });
                        }
                        
                        if (!settings.raidProtection) {
                            settings.raidProtection = { enabled: false, joinThreshold: 5, timeWindow: 10, action: 'kick', whitelist: [], notificationChannel: null, lockdownDuration: 300 };
                        }
                        settings.raidProtection.lockdownDuration = durationValue;
                        saveSettings();
                        
                        const message = durationValue === 0 
                            ? 'Lockdown will remain active until manually unlocked.'
                            : `Lockdown will automatically end after **${durationValue} seconds** (${Math.floor(durationValue / 60)}m ${durationValue % 60}s).`;
                        
                        await interaction.reply({ 
                            content: `✅ Lockdown duration updated!\n\n${message}`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'raid_notification_modal') {
                        const channelInput = interaction.fields.getTextInputValue('channel_id').trim();
                        
                        const channelMatch = channelInput.match(/(\d{17,19})/);
                        if (!channelMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid channel ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const channelId = channelMatch[1];
                        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                        
                        if (!channel || !channel.isTextBased()) {
                            return interaction.reply({ 
                                content: '❌ Channel not found or is not a text channel!', 
                                ephemeral: true 
                            });
                        }
                        
                        if (!settings.raidProtection) {
                            settings.raidProtection = { enabled: false, joinThreshold: 5, timeWindow: 10, action: 'kick', whitelist: [], notificationChannel: null, lockdownDuration: 300 };
                        }
                        settings.raidProtection.notificationChannel = channelId;
                        saveSettings();
                        
                        // Send test message
                        const testEmbed = new EmbedBuilder()
                            .setTitle('✅ Raid Alert Channel Configured')
                            .setDescription('This channel will receive raid protection alerts.')
                            .setColor(0x00FF00)
                            .setTimestamp();
                        
                        await channel.send({ embeds: [testEmbed] }).catch(() => {});
                        
                        await interaction.reply({ 
                            content: `✅ Notification channel set to ${channel}!\n\nA test message has been sent to the channel.`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'raid_whitelist_modal') {
                        const action = interaction.fields.getTextInputValue('whitelist_action').trim().toLowerCase();
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        
                        if (action !== 'add' && action !== 'remove') {
                            return interaction.reply({ 
                                content: '❌ Invalid action! Please enter either "add" or "remove".', 
                                ephemeral: true 
                            });
                        }
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ 
                                content: '❌ Invalid user ID or mention. Please try again.', 
                                ephemeral: true 
                            });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        
                        if (!user) {
                            return interaction.reply({ 
                                content: '❌ User not found!', 
                                ephemeral: true 
                            });
                        }
                        
                        if (!settings.raidProtection) {
                            settings.raidProtection = { enabled: false, joinThreshold: 5, timeWindow: 10, action: 'kick', whitelist: [], notificationChannel: null, lockdownDuration: 300 };
                        }
                        
                        if (action === 'add') {
                            if (settings.raidProtection.whitelist.includes(userId)) {
                                return interaction.reply({ 
                                    content: '❌ This user is already whitelisted!', 
                                    ephemeral: true 
                                });
                            }
                            
                            settings.raidProtection.whitelist.push(userId);
                            saveSettings();
                            
                            await interaction.reply({ 
                                content: `✅ ${user} added to whitelist!\n\nThis user will never be kicked/banned during raid protection.`, 
                                ephemeral: true 
                            });
                        } else {
                            const index = settings.raidProtection.whitelist.indexOf(userId);
                            if (index === -1) {
                                return interaction.reply({ 
                                    content: '❌ This user is not on the whitelist!', 
                                    ephemeral: true 
                                });
                            }
                            
                            settings.raidProtection.whitelist.splice(index, 1);
                            saveSettings();
                            
                            await interaction.reply({ 
                                content: `✅ ${user} removed from whitelist!`, 
                                ephemeral: true 
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error('❌ [MOD MODAL] Error:', error);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
                        }
                    } catch (replyError) {
                        console.error('Failed to send error message:', replyError);
                    }
                }
                return;
            }
        }
    
    } catch (error) {
        const context = interaction.isChatInputCommand() ? `Command: ${interaction.commandName}` : 
                       interaction.isButton() ? `Button: ${interaction.customId}` : 
                       interaction.isModalSubmit() ? `Modal: ${interaction.customId}` :
                       'Unknown Interaction';
        
        console.error(`Error handling ${context}:`, error);
        logCriticalError(error, context, interaction.guildId);
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ An error occurred. Please try again!', 
                    ephemeral: true 
                });
            } else if (interaction.deferred) {
                await interaction.editReply({ 
                    content: '❌ An error occurred. Please try again!' 
                });
            }
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
});

// Monthly AI Knowledge Updater - Fetches latest PlayStation info in REAL-TIME
async function updateAIKnowledge() {
    try {
        console.log('🔄 Updating AI knowledge with REAL-TIME PlayStation information from web...');
        
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');
        
        // Initialize with fallback values
        const psData = {
            ps3OFW: '4.92',
            ps3CFW: '4.92.2 Evilnat',
            ps4OFW: '13.02',
            ps4PPPwn: '11.00',
            ps4BDJB: '12.50',
            ps5OFW: '10.01',
            ps5Lapse: '10.01',
            ps5kstuff: '7.61',
            vita: '3.74',
            psp: '6.61 PRO-C',
            ps2: 'FMCB/ProtoPwn',
            ps1: 'FreePSXBoot',
            goldhen: '2.4b18.6',      // GoldHEN for PS4 (Latest from SiSTRo)
            etahen: '2.0b',           // etaHEN for PS5
            ps3hen: '3.4.0',          // PS3HEN
            hfw: '4.92',              // Hybrid Firmware
            vitashell: 'VitaShell',   // Vita file manager
            adrenaline: 'Adrenaline', // PSP emulator for Vita
            multiman: 'multiMAN',     // PS3/PS4 backup manager
            webman: 'webMAN MOD',     // PS3 file manager
            itemzflow: 'ItemzFlow',   // PS5 PKG installer
            opl: 'OPL'                // Open PS2 Loader
        };
        
        // REAL-TIME: Scrape PSX-Place for latest firmware versions
        try {
            const psxPlaceResponse = await fetch('https://www.psx-place.com/', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const psxPlaceHTML = await psxPlaceResponse.text();
            const $psx = cheerio.load(psxPlaceHTML);
            
            // Extract firmware versions from "Exploited Firmware" section
            const firmwareSection = $psx('body').text();
            
            // PS4 firmware detection
            const ps4Match = firmwareSection.match(/PS4\s*[>:]\s*(\d{1,2}\.\d{2})/i);
            if (ps4Match) psData.ps4PPPwn = ps4Match[1];
            
            // PS5 firmware detection
            const ps5Match = firmwareSection.match(/PS5\s*[>:]\s*(\d{1,2}\.\d{2})/i);
            if (ps5Match) psData.ps5Lapse = ps5Match[1];
            
            // PS3 firmware detection
            const ps3Match = firmwareSection.match(/PS3\s*[>:]\s*(\d\.\d{2})/i);
            if (ps3Match) psData.ps3OFW = ps3Match[1];
            
            // Vita firmware detection
            const vitaMatch = firmwareSection.match(/Vita\s*[>:]\s*(\d\.\d{2})/i);
            if (vitaMatch) psData.vita = vitaMatch[1];
            
            // PSP firmware detection
            const pspMatch = firmwareSection.match(/PSP\s*[>:]\s*(\d\.\d{2})/i);
            if (pspMatch) psData.psp = `${pspMatch[1]} PRO-C`;
            
            console.log('✅ Scraped PSX-Place for real-time firmware data');
        } catch (scrapeError) {
            console.log('⚠️ PSX-Place scrape failed, using cached values:', scrapeError.message);
        }
        
        // REAL-TIME: Scrape Wololo for latest homebrew tool versions
        try {
            const wololoResponse = await fetch('https://wololo.net/', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const wololoHTML = await wololoResponse.text();
            const $wololo = cheerio.load(wololoHTML);
            
            // Look for GoldHEN version
            const goldhenMatch = wololoHTML.match(/GoldHEN\s*v?([\d.]+[a-z]*\d*)/i);
            if (goldhenMatch) psData.goldhen = goldhenMatch[1];
            
            // Look for etaHEN version
            const etahenMatch = wololoHTML.match(/etaHEN\s*v?([\d.]+[a-z]*)/i);
            if (etahenMatch) psData.etahen = etahenMatch[1];
            
            console.log('✅ Scraped Wololo for real-time homebrew tool versions');
        } catch (scrapeError) {
            console.log('⚠️ Wololo scrape failed, using cached values:', scrapeError.message);
        }
        
        // REAL-TIME: Scrape SiSTRo's Ko-fi for latest GoldHEN version
        try {
            const kofiResponse = await fetch('https://ko-fi.com/sistro/shop', {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const kofiHTML = await kofiResponse.text();
            
            // Look for GoldHEN version (e.g., "GoldHEN v2.4b18.6")
            const goldhenKofiMatch = kofiHTML.match(/GoldHEN\s*v(2\.4b[\d.]+)/i);
            if (goldhenKofiMatch) {
                psData.goldhen = goldhenKofiMatch[1];
                console.log(`✅ Scraped SiSTRo Ko-fi: GoldHEN ${psData.goldhen}`);
            }
        } catch (scrapeError) {
            console.log('⚠️ Ko-fi scrape failed, using cached values:', scrapeError.message);
        }
        
        // Update all server settings with REAL-TIME knowledge
        const allSettings = JSON.parse(fsSync.readFileSync('./serverSettings.json', 'utf8'));
        let updated = false;
        
        for (const guildId in allSettings) {
            if (allSettings[guildId].ai && allSettings[guildId].ai.enabled) {
                // Comprehensive gaming database with REAL-TIME data
                allSettings[guildId].ai.systemPrompt = `2025 FIRMWARE: PS3 OFW ${psData.ps3OFW}/CFW ${psData.ps3CFW} | PS4 OFW ${psData.ps4OFW}/JB ${psData.ps4PPPwn} PPPwn ${psData.ps4BDJB} BD-JB+GoldHEN ${psData.goldhen} | PS5 OFW ${psData.ps5OFW}/JB ${psData.ps5Lapse} Lapse ${psData.ps5kstuff} kstuff+etaHEN ${psData.etahen} | Vita ${psData.vita} h-encore | PSP ${psData.psp} | PS2 ${psData.ps2} | PS1 ${psData.ps1}\n\nHOMEBREW GUIDES: PS5(${psData.etahen}→${psData.itemzflow} for PKG) | PS4(${psData.goldhen}→${psData.multiman} for backup) | PS3 CFW(${psData.webman}+${psData.multiman}) HEN(PS3HEN ${psData.ps3hen}+HFW ${psData.hfw}) | Vita(${psData.vitashell}+${psData.adrenaline} for PSP emu) | PSP(PPSSPP for homebrew) | PS2(${psData.opl} for ISO/USB games) | PS1(Tonyhax for exploit)\n\nYou're a hilarious AI for PlayStation Homebrew Discord. Be funny, use memes & gaming jokes. Keep it SHORT (2-3 sentences, under 50 words). British spelling. Swearing's fine. No politics/racism.`;
                
                updated = true;
            }
        }
        
        if (updated) {
            fsSync.writeFileSync('./serverSettings.json', JSON.stringify(allSettings, null, 2));
            const now = new Date();
            console.log(`✅ AI knowledge LIVE-UPDATED from web (${now.toLocaleString()})`);
            console.log(`📊 REAL-TIME DB: PS3 ${psData.ps3OFW}/${psData.ps3CFW} | PS4 ${psData.ps4OFW}/${psData.ps4PPPwn}/${psData.ps4BDJB} | PS5 ${psData.ps5OFW}/${psData.ps5Lapse}/${psData.ps5kstuff}`);
            console.log(`🎮 Homebrew: GoldHEN ${psData.goldhen} | etaHEN ${psData.etahen} | PS3HEN ${psData.ps3hen} | Vita ${psData.vita} | PSP ${psData.psp}`);
        }
    } catch (error) {
        console.error('❌ Failed to update AI knowledge:', error.message);
    }
}

// Run AI knowledge update on startup
setTimeout(() => updateAIKnowledge(), 30000); // 30 seconds after bot starts

// Schedule monthly updates (1st of each month at 3 AM)
setInterval(() => {
    const now = new Date();
    // Check if it's the 1st day of the month at 3 AM
    if (now.getDate() === 1 && now.getHours() === 3 && now.getMinutes() < 10) {
        updateAIKnowledge();
    }
}, 600000); // Check every 10 minutes

// PlayStation Firmware Update Checker - Monitors Sony's official update pages
const lastKnownVersions = {
    vita: '3.74',
    ps3: '4.92',
    ps4: '13.02',
    ps5: '10.01'
};

async function checkPlayStationUpdates() {
    try {
        console.log('🔍 Checking PlayStation firmware updates...');
        
        const fetch = require('node-fetch');
        const cheerio = require('cheerio');
        
        const urls = {
            ps4: 'https://www.playstation.com/en-gb/support/hardware/ps4/system-software/',
            ps5: 'https://www.playstation.com/en-gb/support/hardware/ps5/system-software/',
            ps3: 'https://www.playstation.com/en-gb/support/hardware/ps3/system-software/',
            vita: 'https://www.playstation.com/en-gb/support/hardware/psvita/system-software/'
        };
        
        const allSettings = JSON.parse(fsSync.readFileSync('./serverSettings.json', 'utf8'));
        let updatesFound = [];
        
        // Check PS4 firmware
        try {
            const ps4Response = await fetch(urls.ps4);
            const ps4Html = await ps4Response.text();
            const $ps4 = cheerio.load(ps4Html);
            
            // Look for version number in title or headers (more specific)
            const ps4Text = $ps4('h1, h2, h3, title, .version').text();
            const ps4Match = ps4Text.match(/\b(1[0-9]\.\d{2})\b/); // PS4 versions are 10.00+
            
            if (ps4Match && ps4Match[1] !== lastKnownVersions.ps4) {
                const newVersion = parseFloat(ps4Match[1]);
                const oldVersion = parseFloat(lastKnownVersions.ps4);
                
                // Only alert if new version is HIGHER
                if (newVersion > oldVersion) {
                    updatesFound.push({
                        console: 'PS4',
                        oldVersion: lastKnownVersions.ps4,
                        newVersion: ps4Match[1],
                        emoji: '🎮'
                    });
                    lastKnownVersions.ps4 = ps4Match[1];
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check PS4 updates:', error.message);
        }
        
        // Check PS5 firmware
        try {
            const ps5Response = await fetch(urls.ps5);
            const ps5Html = await ps5Response.text();
            const $ps5 = cheerio.load(ps5Html);
            
            const ps5Text = $ps5('h1, h2, h3, title, .version').text();
            const ps5Match = ps5Text.match(/\b([0-9]\.\d{2})\b/);
            
            if (ps5Match && ps5Match[1] !== lastKnownVersions.ps5) {
                const newVersion = parseFloat(ps5Match[1]);
                const oldVersion = parseFloat(lastKnownVersions.ps5);
                
                if (newVersion > oldVersion) {
                    updatesFound.push({
                        console: 'PS5',
                        oldVersion: lastKnownVersions.ps5,
                        newVersion: ps5Match[1],
                        emoji: '🕹️'
                    });
                    lastKnownVersions.ps5 = ps5Match[1];
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check PS5 updates:', error.message);
        }
        
        // Check PS3 firmware
        try {
            const ps3Response = await fetch(urls.ps3);
            const ps3Html = await ps3Response.text();
            const $ps3 = cheerio.load(ps3Html);
            
            const ps3Text = $ps3('h1, h2, h3, title, .version').text();
            const ps3Match = ps3Text.match(/\b(4\.\d{2})\b/); // PS3 versions are 4.xx
            
            if (ps3Match && ps3Match[1] !== lastKnownVersions.ps3) {
                const newVersion = parseFloat(ps3Match[1]);
                const oldVersion = parseFloat(lastKnownVersions.ps3);
                
                if (newVersion > oldVersion) {
                    updatesFound.push({
                        console: 'PS3',
                        oldVersion: lastKnownVersions.ps3,
                        newVersion: ps3Match[1],
                        emoji: '🎯'
                    });
                    lastKnownVersions.ps3 = ps3Match[1];
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check PS3 updates:', error.message);
        }
        
        // Check PS Vita firmware
        try {
            const vitaResponse = await fetch(urls.vita);
            const vitaHtml = await vitaResponse.text();
            const $vita = cheerio.load(vitaHtml);
            
            const vitaText = $vita('h1, h2, h3, title, .version').text();
            const vitaMatch = vitaText.match(/\b(3\.\d{2})\b/); // Vita versions are 3.xx
            
            if (vitaMatch && vitaMatch[1] !== lastKnownVersions.vita) {
                const newVersion = parseFloat(vitaMatch[1]);
                const oldVersion = parseFloat(lastKnownVersions.vita);
                
                if (newVersion > oldVersion) {
                    updatesFound.push({
                        console: 'PS Vita',
                        oldVersion: lastKnownVersions.vita,
                        newVersion: vitaMatch[1],
                        emoji: '📱'
                    });
                    lastKnownVersions.vita = vitaMatch[1];
                }
            }
        } catch (error) {
            console.log('⚠️ Could not check PS Vita updates:', error.message);
        }
        
        // Send notifications to all servers with logging enabled
        if (updatesFound.length > 0) {
            for (const update of updatesFound) {
                console.log(`🆕 NEW FIRMWARE: ${update.console} ${update.oldVersion} → ${update.newVersion}`);
                
                // Update the AI knowledge database with new firmware
                if (update.console === 'PS4') {
                    for (const guildId in allSettings) {
                        if (allSettings[guildId].ai?.enabled) {
                            const currentPrompt = allSettings[guildId].ai.systemPrompt;
                            allSettings[guildId].ai.systemPrompt = currentPrompt.replace(
                                /PS4 OFW \d{1,2}\.\d{2}/,
                                `PS4 OFW ${update.newVersion}`
                            );
                        }
                    }
                }
                
                // Send notification to specific channel
                try {
                    const notificationChannel = client.channels.cache.get('920750934085222470');
                    
                    if (notificationChannel && notificationChannel.permissionsFor(notificationChannel.guild.members.me).has('SendMessages')) {
                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle(`${update.emoji} ${update.console} Firmware Update Detected!`)
                            .setDescription(`**Sony has released a new firmware update for ${update.console}**`)
                            .addFields(
                                { name: 'Previous Version', value: `\`${update.oldVersion}\``, inline: true },
                                { name: 'New Version', value: `\`${update.newVersion}\``, inline: true }
                            )
                            .addFields({
                                name: '⚠️ Important',
                                value: '**DO NOT UPDATE** if you want to keep your jailbreak!\n\nStay on your current firmware until the scene confirms new exploits.'
                            })
                            .setTimestamp()
                            .setFooter({ text: 'PlayStation Firmware Monitor' });
                        
                        await notificationChannel.send({ embeds: [embed] });
                        console.log(`✅ Firmware update notification sent for ${update.console}`);
                    } else {
                        console.log('⚠️ Could not access notification channel 920750934085222470');
                    }
                } catch (error) {
                    console.log(`⚠️ Could not send update notification:`, error.message);
                }
            }
            
            // Save updated settings if PS4 firmware changed
            fsSync.writeFileSync('./serverSettings.json', JSON.stringify(allSettings, null, 2));
        } else {
            console.log('✅ No new PlayStation firmware updates detected');
        }
    } catch (error) {
        console.error('❌ Failed to check PlayStation updates:', error.message);
    }
}

// Run firmware check on startup (after 1 minute)
setTimeout(() => checkPlayStationUpdates(), 60000);

// Check for updates every 6 hours
setInterval(() => checkPlayStationUpdates(), 21600000); // 6 hours in milliseconds

// Optimized cache cleanup for low-end PCs (more aggressive, less frequent)
setInterval(() => {
    // More aggressive cache clearing for low-end PCs
    if (xpCache.size > 50) xpCache.clear(); // Reduced from 100
    if (levelCache.size > 500) levelCache.clear(); // Reduced from 1000
    if (channelCache.size > 25) channelCache.clear(); // Reduced from 50
    if (errorCodeRegexCache.size > 50) errorCodeRegexCache.clear();
    
    // Clean up old join tracker entries (older than 5 minutes)
    const now = Date.now();
    for (const [guildId, joins] of joinTracker.entries()) {
        joinTracker.set(guildId, joins.filter(j => now - j.timestamp < 300000));
        if (joinTracker.get(guildId).length === 0) joinTracker.delete(guildId);
    }
    
    // Clean up AI conversations older than 1 hour (prevent memory leaks)
    const oneHourAgo = now - 3600000;
    for (const [channelId, messages] of Object.entries(aiConversations)) {
        if (messages.length > 0) {
            // Remove old messages from the conversation
            aiConversations[channelId] = messages.filter(msg => {
                // Keep messages without timestamp or recent messages
                return !msg.timestamp || msg.timestamp > oneHourAgo;
            });
            
            // Delete empty conversations
            if (aiConversations[channelId].length === 0) {
                delete aiConversations[channelId];
            }
        } else {
            delete aiConversations[channelId];
        }
    }
    
    // Clean up AI cooldowns older than 10 minutes
    const tenMinutesAgo = now - 600000;
    for (const [userId, timestamp] of Object.entries(aiCooldowns)) {
        if (timestamp < tenMinutesAgo) {
            delete aiCooldowns[userId];
        }
    }
    
    // Clean up AI user profiles older than 24 hours
    const oneDayAgo = now - 86400000;
    for (const [userId, profile] of Object.entries(aiUserProfiles)) {
        if (profile.recentMessages && profile.recentMessages.length === 0) {
            delete aiUserProfiles[userId];
        }
    }
    
    // Force garbage collection if available (Node.js with --expose-gc flag)
    if (global.gc) {
        global.gc();
        console.log('🧹 Cache cleaned (AI conversations, cooldowns, user profiles) + GC forced');
    } else {
        console.log('🧹 Cache cleaned (AI conversations, cooldowns, user profiles)');
    }
}, 600000); // Every 10 minutes instead of 30 (more frequent cleanup)

// Shared graceful shutdown function
// Prevent multiple shutdown attempts
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('⚠️ Shutdown already in progress...');
        return;
    }
    isShuttingDown = true;
    
    console.log(`⚠️ Received ${signal} - Shutting down gracefully...`);
    
    // Update status channels to show "Offline"
    try {
        const updatePromises = [];
        for (const [guildId, guild] of client.guilds.cache) {
            const settings = getGuildSettings(guildId);
            if (settings.serverStats?.enabled && settings.serverStats.channels.statusChannel) {
                const statusChannel = guild.channels.cache.get(settings.serverStats.channels.statusChannel);
                if (statusChannel && statusChannel.isVoiceBased()) {
                    const newName = settings.serverStats.channelNames.statusChannel
                        .replace('{status}', 'Offline')
                        .replace('🟢', '🔴');
                    
                    // Only update if name actually changes
                    if (statusChannel.name !== newName) {
                        console.log(`🔴 Updating status channel in ${guild.name} to offline...`);
                        updatePromises.push(
                            statusChannel.setName(newName)
                                .then(() => console.log(`✅ Status updated to offline in ${guild.name}`))
                                .catch(err => console.error(`Error updating status in ${guild.name}:`, err.message))
                        );
                    }
                }
            }
        }
        
        // Wait for ALL status updates to complete before continuing shutdown
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log('✅ All status channels updated to offline');
        }
    } catch (error) {
        console.error('Error updating status channels:', error);
    }
    
    // Clear timers if they exist (some may have been removed during optimization)
    if (typeof saveUserDataTimer !== 'undefined') clearTimeout(saveUserDataTimer);
    if (typeof saveSettingsTimer !== 'undefined') clearTimeout(saveSettingsTimer);
    if (typeof saveTicketDataTimer !== 'undefined') clearTimeout(saveTicketDataTimer);
    if (typeof saveModerationDataTimer !== 'undefined') clearTimeout(saveModerationDataTimer);
    
    fsSync.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
    await fs.writeFile(settingsFile, JSON.stringify(serverSettings, null, 2));
    await fs.writeFile(ticketDataFile, JSON.stringify(ticketData, null, 2));
    await fs.writeFile(moderationDataFile, JSON.stringify(moderationData, null, 2));
    console.log('💾 All data saved');
    console.log('👋 Goodbye!');
    process.exit(0);
}

// Graceful shutdown handlers for different signals
process.on('SIGINT', () => gracefulShutdown('SIGINT (Ctrl+C)'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM (Stop-Process)'));

// Global error handlers with Discord logging
process.on('unhandledRejection', async (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    logCriticalError(error, 'Unhandled Promise Rejection', null);
    
    // Log to all guilds
    for (const guild of client.guilds.cache.values()) {
        await logEvent(guild, 'critical', {
            error: 'Unhandled Promise Rejection: ' + error.message,
            stack: error.stack
        });
    }
});

process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error);
    logCriticalError(error, 'Uncaught Exception', null);
    
    // Log to all guilds
    for (const guild of client.guilds.cache.values()) {
        await logEvent(guild, 'critical', {
            error: 'Uncaught Exception: ' + error.message,
            stack: error.stack
        });
    }
    
    // Save data before attempting recovery
    try {
        fsSync.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
        await fs.writeFile(settingsFile, JSON.stringify(serverSettings, null, 2));
        await fs.writeFile(ticketDataFile, JSON.stringify(ticketData, null, 2));
        await fs.writeFile(moderationDataFile, JSON.stringify(moderationData, null, 2));
        console.log('💾 Emergency data save completed');
    } catch (saveError) {
        console.error('❌ Failed to save data during crash:', saveError);
    }
    
    // Don't exit - try to recover
    console.log('⚠️ Attempting to recover from uncaught exception...');
});

// Discord client error handlers
client.on('error', async (error) => {
    console.error('❌ Discord client error:', error);
    logCriticalError(error, 'Discord Client Error', null);
    
    for (const guild of client.guilds.cache.values()) {
        await logEvent(guild, 'critical', {
            error: 'Discord Client Error: ' + error.message,
            stack: error.stack
        });
    }
});

client.on('warn', (warning) => {
    console.warn('⚠️ Discord client warning:', warning);
});

client.on('shardError', (error) => {
    console.error('❌ Websocket connection error:', error);
    logCriticalError(error, 'WebSocket/Shard Error', null);
});

// Rate limit handler
client.rest.on('rateLimited', (info) => {
    console.warn('⚠️ Rate limited:', info);
    const errorMsg = `Route: ${info.route || 'Unknown'}, Timeout: ${info.timeout}ms, Global: ${info.global}`;
    logCriticalError(new Error(errorMsg), 'Discord API Rate Limited', null);
});

// Login to Discord with error handling
client.login(config.token).catch(error => {
    console.error('❌ Failed to login to Discord:', error);
    console.error('Please check your bot token in config.json');
    process.exit(1);
});
