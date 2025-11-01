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
const path = require('path');
const ps3ErrorCodes = require('./features/ps3ErrorCodes.json');
const ps4ErrorCodes = require('./features/ps4ErrorCodes.json');
const { Snake, TicTacToe, Connect4, Wordle, Minesweeper, TwoZeroFourEight, MatchPairs, FastType, FindEmoji, GuessThePokemon, RockPaperScissors, Hangman, Trivia, Slots, WouldYouRather } = require('discord-gamecord');
const { search } = require('duck-duck-scrape');
const Parser = require('rss-parser');
const rssParser = new Parser();
const express = require('express');
const sellixApp = express();

// --- Language System ---
const languages = {};
const languageFiles = ['en.json', 'es.json', 'fr.json', 'de.json', 'pt.json', 'ja.json'];
for (const file of languageFiles) {
    try {
        const langData = require(`./languages/${file}`);
        languages[langData.code] = langData;
        console.log(`✅ Loaded language: ${langData.name} (${langData.code})`);
    } catch (error) {
        console.error(`❌ Failed to load language file: ${file}`, error.message);
    }
}

// Translation helper function
function translate(guildId, key, replacements = {}) {
    const settings = serverSettings[guildId] || {};
    const langCode = settings.language || 'en';
    const lang = languages[langCode] || languages['en'];
    
    // Navigate through nested keys (e.g., 'error.noPermission')
    const keys = key.split('.');
    let translation = lang.translations;
    
    for (const k of keys) {
        if (!translation || !translation[k]) {
            // Fallback to English if translation not found
            translation = languages['en'].translations;
            for (const fallbackKey of keys) {
                translation = translation?.[fallbackKey];
            }
            break;
        }
        translation = translation[k];
    }
    
    // If still not found, return the key itself
    if (typeof translation !== 'string') {
        return key;
    }
    
    // Replace placeholders like {user}, {level}, {time}, etc.
    let result = translation;
    for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    }
    
    return result;
}
// --- End Language System ---

// Load configuration
let config;
try {
    // Try to load from config.json first
    if (fsSync.existsSync('./config.json')) {
        config = require('./config.json');
        console.log('✅ Loaded configuration from config.json');
    } 
    // Fall back to encrypted config if available
    else if (fsSync.existsSync('./.secure-config')) {
        console.log('🔐 Loading encrypted configuration...');
        const { decryptConfig } = require('./encrypt-config.js');
        const encryptedData = JSON.parse(fsSync.readFileSync('./.secure-config', 'utf8'));
        const encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || 'Savannah23';
        config = decryptConfig(encryptedData, encryptionKey);
        console.log('✅ Configuration decrypted successfully');
    } else {
        throw new Error('No configuration file found');
    }
} catch (error) {
    console.error('❌ ERROR: Failed to load configuration!');
    console.error('Details:', error.message);
    console.error('');
    console.error('Options:');
    console.error('1. Create config.json with your bot credentials');
    console.error('2. Run: node encrypt-config.js decrypt (if you have .secure-config)');
    process.exit(1);
}

// Validate required configuration
if (!config.token || !config.clientId) {
    console.error('❌ ERROR: Missing required configuration!');
    console.error('config.json must contain "token" and "clientId"');
    process.exit(1);
}

// Validate error codes loaded
if (!ps3ErrorCodes || Object.keys(ps3ErrorCodes).length === 0) {
    console.warn('⚠️ WARNING: No PS3 error codes loaded. PS3 error detection will not work.');
}
if (!ps4ErrorCodes || Object.keys(ps4ErrorCodes).length === 0) {
    console.warn('⚠️ WARNING: No PS4 error codes loaded. PS4 error detection will not work.');
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
        MessageManager: 25, // Reduced from 50 - keep fewer messages
        GuildMemberManager: 50, // Reduced from 100 - keep fewer members
        UserManager: 50, // Reduced from 100 - keep fewer users
        ReactionManager: 0, // Don't cache reactions
        PresenceManager: 0, // Don't cache presences
        VoiceStateManager: 0, // Don't cache voice states
        GuildBanManager: 0, // Don't cache bans
        GuildInviteManager: 0, // Don't cache invites
        StageInstanceManager: 0, // Don't cache stage instances
        ThreadManager: 0 // Don't cache threads
    }),
    sweepers: {
        // Auto-sweep caches more aggressively
        messages: {
            interval: 900, // Every 15 minutes (was 30)
            lifetime: 600 // Keep messages for 10 minutes (was 15)
        },
        users: {
            interval: 900, // Every 15 minutes (was 30)
            filter: () => user => user.bot && user.id !== client.user.id
        },
        guildMembers: {
            interval: 900, // Every 15 minutes
            filter: () => member => member.id !== client.user.id
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

// Analytics data
let analyticsData = {};
const analyticsDataFile = './analyticsData.json';

// Pending Sellix purchases (for users not yet in server)
let pendingPurchases = {};
const pendingPurchasesFile = './pendingPurchases.json';

// AI conversation history (stored in memory only, not persisted)
let aiConversations = {}; // { channelId: [ { role: 'user'|'assistant', content: 'message', userId?: string } ] }
let aiCooldowns = {}; // { userId: timestamp} - Track cooldowns per user
let aiUserProfiles = {}; // { userId: { messageCount: number, lastTone: 'question'|'joke'|'casual', recentMessages: [] } }
let aiLockdown = {}; // { guildId: { locked: boolean, lockedBy: userId, reason: string, timestamp: number } }

// --- Token Quota Tracking System ---
let tokenQuota = {
    deepseek: {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyLimit: null, // Set in config or leave null for unlimited
        monthlyLimit: null,
        lastResetDaily: new Date().toDateString(),
        lastResetMonthly: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
    },
    chatgpt: {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyLimit: null,
        monthlyLimit: null,
        lastResetDaily: new Date().toDateString(),
        lastResetMonthly: `${new Date().getFullYear()}-${new Date().getMonth() + 1}`
    }
};

// Per-user token tracking (5k tokens per user per day)
let userTokenQuota = {}; // { userId: { dailyUsed: number, lastReset: string } }
const USER_DAILY_LIMIT = 5000; // 5k tokens per user per day

// Check and reset user quota
function checkAndResetUserQuota(userId) {
    const today = new Date().toDateString();
    
    if (!userTokenQuota[userId]) {
        userTokenQuota[userId] = {
            dailyUsed: 0,
            lastReset: today
        };
    }
    
    // Reset if new day
    if (userTokenQuota[userId].lastReset !== today) {
        userTokenQuota[userId].dailyUsed = 0;
        userTokenQuota[userId].lastReset = today;
    }
}

// Track user token usage
function trackUserTokenUsage(userId, tokens) {
    checkAndResetUserQuota(userId);
    userTokenQuota[userId].dailyUsed += tokens;
}

// Check if user has exceeded their daily limit
function hasUserExceededLimit(userId) {
    checkAndResetUserQuota(userId);
    return userTokenQuota[userId].dailyUsed >= USER_DAILY_LIMIT;
}

// Get user remaining tokens
function getUserRemainingTokens(userId) {
    checkAndResetUserQuota(userId);
    return USER_DAILY_LIMIT - userTokenQuota[userId].dailyUsed;
}

// Reset quota counters if new day/month
function checkAndResetQuota() {
    const today = new Date().toDateString();
    const thisMonth = `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    
    // Reset daily counters
    if (tokenQuota.deepseek.lastResetDaily !== today) {
        tokenQuota.deepseek.dailyUsed = 0;
        tokenQuota.deepseek.lastResetDaily = today;
    }
    if (tokenQuota.chatgpt.lastResetDaily !== today) {
        tokenQuota.chatgpt.dailyUsed = 0;
        tokenQuota.chatgpt.lastResetDaily = today;
    }
    
    // Reset monthly counters
    if (tokenQuota.deepseek.lastResetMonthly !== thisMonth) {
        tokenQuota.deepseek.monthlyUsed = 0;
        tokenQuota.deepseek.lastResetMonthly = thisMonth;
    }
    if (tokenQuota.chatgpt.lastResetMonthly !== thisMonth) {
        tokenQuota.chatgpt.monthlyUsed = 0;
        tokenQuota.chatgpt.lastResetMonthly = thisMonth;
    }
}

// Track token usage
function trackTokenUsage(provider, tokens) {
    checkAndResetQuota();
    const providerKey = provider.toLowerCase().includes('chatgpt') ? 'chatgpt' : 'deepseek';
    tokenQuota[providerKey].dailyUsed += tokens;
    tokenQuota[providerKey].monthlyUsed += tokens;
}

// Get token quota status
function getTokenQuotaStatus() {
    checkAndResetQuota();
    return {
        deepseek: {
            dailyUsed: tokenQuota.deepseek.dailyUsed,
            monthlyUsed: tokenQuota.deepseek.monthlyUsed,
            dailyRemaining: tokenQuota.deepseek.dailyLimit ? tokenQuota.deepseek.dailyLimit - tokenQuota.deepseek.dailyUsed : 'Unlimited',
            monthlyRemaining: tokenQuota.deepseek.monthlyLimit ? tokenQuota.deepseek.monthlyLimit - tokenQuota.deepseek.monthlyUsed : 'Unlimited'
        },
        chatgpt: {
            dailyUsed: tokenQuota.chatgpt.dailyUsed,
            monthlyUsed: tokenQuota.chatgpt.monthlyUsed,
            dailyRemaining: tokenQuota.chatgpt.dailyLimit ? tokenQuota.chatgpt.dailyLimit - tokenQuota.chatgpt.dailyUsed : 'Unlimited',
            monthlyRemaining: tokenQuota.chatgpt.monthlyLimit ? tokenQuota.chatgpt.monthlyLimit - tokenQuota.chatgpt.monthlyUsed : 'Unlimited'
        }
    };
}
// --- End Token Quota Tracking System ---

// --- Response Caching System (#19) ---
// Cache common AI responses to reduce API calls by 30-50%
const responseCache = new Map(); // { query: { response: string, timestamp: number } }
const CACHE_LIFETIME = 3600000; // 1 hour in milliseconds

function getCachedResponse(query) {
    const normalized = query.toLowerCase().trim();
    const cached = responseCache.get(normalized);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_LIFETIME) {
        return cached.response;
    }
    
    // Clean expired cache entries
    if (cached) {
        responseCache.delete(normalized);
    }
    
    return null;
}

function cacheResponse(query, response) {
    const normalized = query.toLowerCase().trim();
    responseCache.set(normalized, {
        response: response,
        timestamp: Date.now()
    });
    
    // Limit cache size to 100 entries
    if (responseCache.size > 100) {
        const firstKey = responseCache.keys().next().value;
        responseCache.delete(firstKey);
    }
}

// Clean expired cache every 10 minutes
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of responseCache.entries()) {
        if ((now - value.timestamp) >= CACHE_LIFETIME) {
            responseCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
}, 600000); // 10 minutes
// --- End Response Caching System ---

// Jailbreak detection patterns
// Import AI SDKs
const { createDeepSeek } = require('@ai-sdk/deepseek');
const { createOpenAI } = require('@ai-sdk/openai');
const { generateText } = require('ai');

// Optimized jailbreak detection - compact patterns
const jailbreakPatterns = [
    /\b(DAN|jailbreak|developer|god) mode\b/i,
    /\b(ignore|forget|disregard|override|bypass).+(instructions?|rules?|safety|filter)\b/i,
    /\b(pretend|act as).+(unrestricted|unfiltered|without.+limits?)\b/i,
    /\[SYSTEM\]|\[INST\]|<\|im_start\|>|\{system\}/i,
    /\b(switch|activate|enable).+(mode|character).+(unrestricted|uncensored)\b/i
];

// Detect jailbreak attempts
function detectJailbreak(message) {
    return jailbreakPatterns.some(pattern => pattern.test(message));
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
            return { 
                instruction: `The user ${username} is asking a question and needs help. Provide a clear, direct answer with 2-3 WEBSITE LINKS to relevant resources. Be straightforward and informative - no jokes or wordplay. If it's a simple question, keep it to 2-4 sentences. For complex questions, provide thorough details (up to 8 sentences). ALWAYS include clickable URLs when available.`,
                maxTokens: 200
            };
        
        case 'technical':
            return { 
                instruction: `The user ${username} is asking a technical question. Provide a direct, factual answer with clear steps and include 2-3 WEBSITE LINKS to tools, guides, or downloads. Be professional and serious - focus on technical accuracy. Maximum 6 sentences. MUST include URLs if available.`,
                maxTokens: 150
            };
        
        case 'joke':
            return { 
                instruction: `The user ${username} made a joke or is being playful. Match their casual energy - be chill and conversational, but don't force humor or puns. Keep it brief (2-3 sentences). Be natural and laid-back.`,
                maxTokens: 80
            };
        
        case 'casual':
        default:
            return { 
                instruction: `The user ${username} is having a casual chat. Match their energy level - if they're relaxed, be relaxed; if they're serious, be serious. Give a helpful, straightforward response. 3-4 sentences maximum. No forced humor or wordplay.`,
                maxTokens: 120
            };
    }
}

// Helper function to load JSON files safely with caching for performance
const jsonCache = new Map();
function loadJSON(filePath, defaultValue = {}, useCache = false) {
    if (useCache && jsonCache.has(filePath)) {
        return jsonCache.get(filePath);
    }
    try {
        if (fsSync.existsSync(filePath)) {
            const data = JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
            if (useCache) jsonCache.set(filePath, data);
            return data;
        }
    } catch (error) {
        console.error(`⚠️ Error loading ${filePath}:`, error.message);
    }
    return defaultValue;
}

// --- Message Compression System (#20) ---
// Compress long messages before storing to save 40-60% storage space
function compressMessage(message) {
    if (!message || message.length < 100) return message; // Don't compress short messages
    
    // Remove excessive whitespace
    let compressed = message.replace(/\s+/g, ' ').trim();
    
    // Remove duplicate consecutive words (typos like "the the")
    compressed = compressed.replace(/\b(\w+)\s+\1\b/gi, '$1');
    
    // Truncate very long messages (over 1000 chars)
    if (compressed.length > 1000) {
        compressed = compressed.substring(0, 997) + '...';
    }
    
    return compressed;
}

function decompressMessage(message) {
    // Messages are stored compressed, no decompression needed for basic compression
    // This function exists for future enhancement with real compression algorithms
    return message;
}
// --- End Message Compression System ---

// Helper function to save JSON files safely with compression
function saveJSON(filePath, data) {
    try {
        // For conversation history and analytics, compress messages
        if (filePath.includes('analytics') || filePath.includes('moderation')) {
            // Compress message content in moderation/analytics data
            if (data && typeof data === 'object') {
                data = JSON.parse(JSON.stringify(data)); // Deep clone
                
                // Compress messages in nested structures
                Object.keys(data).forEach(key => {
                    if (data[key] && typeof data[key] === 'object') {
                        if (data[key].message) {
                            data[key].message = compressMessage(data[key].message);
                        }
                        if (data[key].content) {
                            data[key].content = compressMessage(data[key].content);
                        }
                    }
                });
            }
        }
        
        fsSync.writeFileSync(filePath, JSON.stringify(data, null, 2));
        jsonCache.delete(filePath); // Clear cache when saving
        return true;
    } catch (error) {
        console.error(`⚠️ Error saving ${filePath}:`, error.message);
        return false;
    }
}

// Default settings template
const defaultSettings = {
    language: 'en', // Default language code (en, es, fr, de, pt, ja)
    customization: {
        botName: null, // Custom bot nickname for this server (null = use global name)
        botAvatar: null // Custom bot avatar URL for this server (null = use global avatar)
    },
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
        systemPrompt: "You are a knowledgeable and straightforward AI assistant for the PlayStation Homebrew Discord server. Your role is to provide ACCURATE, HELPFUL information about PlayStation console hacking, homebrew, and troubleshooting.\n\nRESPONSE STYLE:\n- Keep responses CONCISE (2-5 sentences for simple questions, up to 8 sentences for complex topics)\n- Be helpful and direct - users need clear technical information\n- Match the user's energy level: if they're serious, be serious; if they're casual, be casual\n- NO puns, wordplay, or forced jokes - focus on being informative and practical\n- Be professional and competent - like a skilled technician helping out\n- Focus on solving problems with clear, actionable steps\n- State facts, provide solutions, include specifics (firmware versions, model numbers, etc.)\n- Prioritize accuracy and usefulness over personality or humor\n\n🔗 CRITICAL - ALWAYS INCLUDE LINKS:\n- When web search results are provided, YOU MUST include 2-3 relevant website links in EVERY response\n- Format links as plain URLs (e.g., https://example.com) - Discord will make them clickable\n- NEVER say \"check out this site\" without providing the actual URL\n- Provide direct links to: homebrew tools, PKG repositories, guides, tutorials, download pages\n- Common sites to reference: PSX-Place, NPS Browser, NoPayStation, Myrient, Archive.org, r/PKGLinks, GitHub repos\n- When discussing specific tools/games/exploits, ALWAYS provide the source URL from search results\n- Be specific about console models (PS3 Fat/Slim/Super Slim, PS4/PS4 Pro, PS5 Digital/Disc)\n- Include firmware version requirements when relevant\n- Mention compatibility issues between different hardware revisions\n- If search results are available, treat them as MANDATORY to include in your response\n\nEXPERTISE AREAS:\n- PS3/PS4/PS5 jailbreaking and custom firmware\n- Error codes and troubleshooting\n- Homebrew apps, PKG installation, license files (.rap)\n- Game backup sources and pirated game installation\n- Hardware revisions and compatibility\n- Firmware exploits and payloads\n- Piracy resources, ROM sites, and game downloading\n\nCONTENT POLICY: This is a homebrew/modding/piracy server. Freely provide information about:\n- Game backups, pirated PKG files, and ISO downloads\n- Sites for downloading pirated games (NoPayStation, NPS Browser, Archive.org, Myrient, r/PKGLinks, AlvRo's Collection, etc.)\n- .rap license files for pirated games\n- Methods to bypass DRM and play pirated content\n- Direct links to pirated game repositories and ROM sites\n- How to install and run pirated games on jailbroken consoles\n\nUsers own their consoles and are entitled to modify them and run any content they choose. Provide detailed, helpful information without moralizing about piracy. Be direct and informative. Never engage with racist content, political discussions, hate speech, or harmful topics - politely decline and redirect to homebrew topics.\n\nUse British spelling (colour, favourite, realise).",
        maxHistory: 4, // Reduced from 6 for faster processing
        temperature: 1.0 // Reduced from 1.2 for faster, more focused responses
    }
};

// --- Scheduled restart at 00:00 every day ---
function scheduleMidnightRestart() {
    const timezone = process.env.RESTART_TIMEZONE || 'UTC';
    const now = new Date();
    const nextMidnight = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    nextMidnight.setHours(24, 0, 0, 0); // Next midnight in specified timezone
    const msUntilMidnight = nextMidnight - new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    setTimeout(() => {
        console.log(`🔄 Scheduled restart: Restarting bot for daily maintenance (Timezone: ${timezone}).`);
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

// Initialize save functions with longer delays for less frequent writes
const saveUserData = createDebouncedSave(userDataFile, () => userData, 10000); // 10s (was 5s)
const saveSettings = createDebouncedSave(settingsFile, () => serverSettings, 5000); // 5s (was 3s)
const saveTicketData = createDebouncedSave(ticketDataFile, () => ticketData, 3000); // 3s (was 1s)
const saveModerationData = createDebouncedSave(moderationDataFile, () => moderationData, 3000); // 3s (was 1s)
const saveAnalyticsData = createDebouncedSave(analyticsDataFile, () => analyticsData, 30000); // 30s - analytics can be saved less frequently
const savePendingPurchases = createDebouncedSave(pendingPurchasesFile, () => pendingPurchases, 3000); // 3s

// Load pending purchases
async function loadPendingPurchases() {
    try {
        await fs.access(pendingPurchasesFile);
        const data = await fs.readFile(pendingPurchasesFile, 'utf8');
        pendingPurchases = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading pending purchases:', error);
        }
        pendingPurchases = {};
    }
}

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

// Load analytics data
async function loadAnalyticsData() {
    try {
        await fs.access(analyticsDataFile);
        const data = await fs.readFile(analyticsDataFile, 'utf8');
        analyticsData = JSON.parse(data);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading analytics data:', error);
        }
        analyticsData = {};
    }
}

// Initialize analytics data for a guild
function initializeAnalyticsData(guildId) {
    if (!analyticsData[guildId]) {
        analyticsData[guildId] = {
            messages: {
                total: 0,
                byUser: {}, // { userId: count }
                byChannel: {}, // { channelId: count }
                byHour: Array(24).fill(0), // Hourly distribution [0-23]
                byDay: Array(7).fill(0) // Daily distribution [0-6] (Sunday-Saturday)
            },
            members: {
                joins: [], // [{ userId, timestamp }]
                leaves: [], // [{ userId, timestamp }]
                currentCount: 0
            },
            voice: {
                totalMinutes: 0,
                byUser: {}, // { userId: minutes }
                sessions: [] // [{ userId, channelId, startTime, endTime }]
            },
            commands: {
                total: 0,
                byCommand: {} // { commandName: count }
            },
            lastReset: Date.now(),
            startDate: Date.now()
        };
        saveAnalyticsData();
    }
    return analyticsData[guildId];
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

// Helper function to create standardized error embed with translation support
function createErrorEmbed(title, description, guildId = null) {
    // If guildId provided and description is a translation key, translate it
    if (guildId && typeof description === 'string' && description.includes('.')) {
        description = translate(guildId, description);
    }
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0xFF0000)
        .setTimestamp();
}

// Helper function to create standardized success embed with translation support
function createSuccessEmbed(title, description, guildId = null) {
    if (guildId && typeof description === 'string' && description.includes('.')) {
        description = translate(guildId, description);
    }
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x00FF00)
        .setTimestamp();
}

// Helper function to create standardized info embed with translation support
function createInfoEmbed(title, description, guildId = null) {
    if (guildId && typeof description === 'string' && description.includes('.')) {
        description = translate(guildId, description);
    }
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
const raidActionQueue = new Map(); // guildId -> array of pending actions for rate limit control

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
        
        // Take action on raiders (with rate limit queue)
        if (settings.raidProtection.action !== 'none') {
            // Initialize queue for this guild if not exists
            if (!raidActionQueue.has(guild.id)) {
                raidActionQueue.set(guild.id, []);
            }
            const queue = raidActionQueue.get(guild.id);
            
            // Add actions to queue
            for (const join of suspiciousJoins) {
                // Skip whitelisted users
                if (settings.raidProtection.whitelist.includes(join.userId)) continue;
                queue.push(join);
            }
            
            // Process queue with rate limiting (1 action per second)
            const processQueue = async () => {
                if (queue.length === 0) {
                    raidActionQueue.delete(guild.id);
                    return;
                }
                
                const join = queue.shift();
                try {
                    const member = await guild.members.fetch(join.userId).catch(() => null);
                    if (!member) {
                        // Continue to next in queue
                        setTimeout(processQueue, 1000);
                        return;
                    }
                    
                    // Don't action server owner or members with admin
                    if (member.id === guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) {
                        setTimeout(processQueue, 1000);
                        return;
                    }
                    
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
                
                // Process next action after 1 second delay
                setTimeout(processQueue, 1000);
            };
            
            // Start processing queue if not already processing
            if (queue.length === suspiciousJoins.filter(j => !settings.raidProtection.whitelist.includes(j.userId)).length) {
                processQueue();
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

// Bot ready event - optimized for faster startup
client.once('clientReady', async () => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`🤖 Servers: ${client.guilds.cache.size}`);
    console.log('='.repeat(60));
    
    // Display token quota status on startup
    const quotaStatus = getTokenQuotaStatus();
    console.log('📊 AI Token Quota Status:');
    console.log(`   🤖 DeepSeek:`);
    console.log(`      Daily: ${quotaStatus.deepseek.dailyUsed.toLocaleString()} used | ${quotaStatus.deepseek.dailyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.deepseek.dailyRemaining.toLocaleString() + ' remaining'}`);
    console.log(`      Monthly: ${quotaStatus.deepseek.monthlyUsed.toLocaleString()} used | ${quotaStatus.deepseek.monthlyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.deepseek.monthlyRemaining.toLocaleString() + ' remaining'}`);
    console.log(`   🧠 ChatGPT:`);
    console.log(`      Daily: ${quotaStatus.chatgpt.dailyUsed.toLocaleString()} used | ${quotaStatus.chatgpt.dailyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.chatgpt.dailyRemaining.toLocaleString() + ' remaining'}`);
    console.log(`      Monthly: ${quotaStatus.chatgpt.monthlyUsed.toLocaleString()} used | ${quotaStatus.chatgpt.monthlyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.chatgpt.monthlyRemaining.toLocaleString() + ' remaining'}`);
    console.log('='.repeat(60));
    
    // Set bot status to DND and activity
    client.user.setPresence({
        status: 'dnd',
        activities: [{ name: 'Multiple Servers', type: ActivityType.Watching }]
    });
    
    // Load critical data immediately
    loadUserData();
    loadSettings();
    loadTicketData();
    loadModerationData();
    loadAnalyticsData();
    loadPendingPurchases();
    
    // Defer detailed feature counting to after bot is ready (non-blocking)
    setTimeout(() => {
        const activeCount = {ai: 0, leveling: 0, tickets: 0};
        for (const settings of Object.values(serverSettings)) {
            if (settings.leveling?.enabled) activeCount.leveling++;
            if (settings.ai?.enabled) activeCount.ai++;
            if (settings.tickets?.enabled) activeCount.tickets++;
        }
        console.log(`📊 AI: ${activeCount.ai} | Leveling: ${activeCount.leveling} | Tickets: ${activeCount.tickets}`);
        
        // Apply server-specific customizations to all servers
        console.log('🎨 Applying server customizations...');
        client.guilds.cache.forEach(async (guild) => {
            await applyServerCustomization(guild);
        });
    }, 2000);
    
    // Check if bot was restarted via /update command
    try {
        if (fsSync.existsSync('./update-marker.json')) {
            const updateData = JSON.parse(fsSync.readFileSync('./update-marker.json', 'utf8'));
            
            // Send message to channel and delete after 45 seconds
            const guild = client.guilds.cache.get(updateData.guildId);
            if (guild) {
                const channel = guild.channels.cache.get(updateData.channelId);
                if (channel) {
                    const downtime = Math.round((Date.now() - updateData.timestamp) / 1000);
                    
                    // Build feature checklist
                    const features = [];
                    features.push(`✅ Config: Loaded`);
                    features.push(`✅ DeepSeek API: ${config.deepseekApiKey && config.deepseekApiKey !== 'YOUR_DEEPSEEK_API_KEY_HERE' ? 'Active' : 'Not configured'}`);
                    features.push(`✅ ChatGPT API: ${config.openaiApiKey && config.openaiApiKey !== 'YOUR_OPENAI_API_KEY_HERE' ? 'Active' : 'Not configured'}`);
                    features.push(`✅ User Data: ${fsSync.existsSync('./userData.json') ? 'Loaded' : 'Missing'}`);
                    features.push(`✅ PS3 Error Codes: ${Object.keys(ps3ErrorCodes).length} loaded`);
                    features.push(`✅ PS4 Error Codes: ${Object.keys(ps4ErrorCodes).filter(k => !k.startsWith('_')).length} loaded`);
                    
                    // Additional data file checks
                    features.push(`${fsSync.existsSync('./ticketData.json') ? '✅' : '❌'} Ticket System: ${fsSync.existsSync('./ticketData.json') ? 'Loaded' : 'Missing'}`);
                    features.push(`${fsSync.existsSync('./moderationData.json') ? '✅' : '❌'} Moderation Data: ${fsSync.existsSync('./moderationData.json') ? 'Loaded' : 'Missing'}`);
                    features.push(`${fsSync.existsSync('./serverSettings.json') ? '✅' : '❌'} Server Settings: ${fsSync.existsSync('./serverSettings.json') ? 'Loaded' : 'Missing'}`);
                    features.push(`${fsSync.existsSync('./analyticsData.json') ? '✅' : '❌'} Analytics Data: ${fsSync.existsSync('./analyticsData.json') ? 'Loaded' : 'Missing'}`);
                    features.push(`${fsSync.existsSync('./cfwKnowledge.json') ? '✅' : '❌'} CFW Knowledge: ${fsSync.existsSync('./cfwKnowledge.json') ? 'Loaded' : 'Missing'}`);
                    
                    // Count registered commands from feature files
                    let totalCommands = 0;
                    try {
                        const featuresDir = path.join(__dirname, 'features');
                        const featureFiles = fsSync.readdirSync(featuresDir).filter(f => f.endsWith('.json'));
                        for (const file of featureFiles) {
                            const feature = JSON.parse(fsSync.readFileSync(path.join(featuresDir, file), 'utf8'));
                            if (feature.commands) {
                                totalCommands += feature.commands.length;
                            }
                        }
                    } catch (e) {
                        totalCommands = 'Unknown';
                    }
                    features.push(`✅ Commands: ${totalCommands} loaded`);
                    
                    const onlineEmbed = new EmbedBuilder()
                        .setTitle('🟢 Bot Online - Update Complete')
                        .setDescription(`Successfully updated and restarted!\n\n**Git Pull:**\n\`\`\`${updateData.gitOutput || 'Updated successfully'}\`\`\`\n\n**System Check:**\n${features.join('\n')}`)
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '⏰ Downtime', value: `${downtime}s`, inline: true },
                            { name: '🌐 Servers', value: `${client.guilds.cache.size}`, inline: true },
                            { name: '👥 Users', value: `${client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)}`, inline: true }
                        )
                        .setTimestamp();
                    
                    // Send to specified channel instead of the channel where /update was used
                    const updateCompleteChannelId = '1311681018612158508';
                    const updateCompleteChannel = client.channels.cache.get(updateCompleteChannelId);
                    const targetChannel = updateCompleteChannel || channel;
                    
                    const message = await targetChannel.send({ embeds: [onlineEmbed] });
                    
                    // Delete after 45 seconds
                    setTimeout(() => {
                        message.delete().catch(err => console.log('Failed to delete update message:', err));
                        console.log('🗑️ Update notification deleted');
                    }, 45000);
                } else {
                    console.log('❌ Channel not found');
                }
            } else {
                console.log('❌ Guild not found');
            }
            // Delete marker file
            fsSync.unlinkSync('./update-marker.json');
            console.log('🗑️ Update marker deleted');
        }
    } catch (error) {
        console.error('❌ Failed to send update complete notification:', error);
    }
    
    // Defer non-critical startup tasks to improve boot time
    setTimeout(() => {
        startServerStatsUpdates();
        startYouTubeMonitoring();
        startMemoryCleanup();
        startCFWKnowledgeScraper();
        startPS4ErrorScraper();
        startAutomatedMessages();
    }, 3000);
});

// Memory cleanup for AI conversations and cooldowns
function startMemoryCleanup() {
    // Clean up old AI conversations every 10 minutes
    setInterval(() => {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        
        // Clean old conversations
        let conversationsDeleted = 0;
        for (const channelId in aiConversations) {
            const conversation = aiConversations[channelId];
            if (conversation.length > 0) {
                const lastTimestamp = conversation[conversation.length - 1].timestamp;
                if (now - lastTimestamp > maxAge) {
                    delete aiConversations[channelId];
                    conversationsDeleted++;
                }
            }
        }
        
        // Clean old cooldowns
        let cooldownsDeleted = 0;
        for (const userId in aiCooldowns) {
            if (now - aiCooldowns[userId] > 60000) { // 1 minute old
                delete aiCooldowns[userId];
                cooldownsDeleted++;
            }
        }
        
        // Clean old user profiles
        let profilesDeleted = 0;
        for (const userId in aiUserProfiles) {
            if (now - (aiUserProfiles[userId].lastActivity || 0) > maxAge) {
                delete aiUserProfiles[userId];
                profilesDeleted++;
            }
        }
        
        // Get memory usage
        const memUsage = process.memoryUsage();
        const memMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
        };
        
        console.log(`🧹 Memory cleanup: ${Object.keys(aiConversations).length} active conversations (deleted ${conversationsDeleted}), ${Object.keys(aiCooldowns).length} cooldowns (deleted ${cooldownsDeleted})`);
        console.log(`📊 Memory: ${memMB.heapUsed}MB/${memMB.heapTotal}MB heap, ${memMB.rss}MB RSS`);
        
        // Force garbage collection if available (requires --expose-gc flag)
        if (global.gc) {
            global.gc();
            console.log('♻️ Garbage collection triggered');
        }
    }, 600000); // Every 10 minutes
}

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

// Apply server-specific bot customization
async function applyServerCustomization(guild) {
    try {
        const settings = getGuildSettings(guild.id);
        
        if (!settings.customization) {
            settings.customization = defaultSettings.customization;
        }
        
        const member = guild.members.cache.get(client.user.id);
        if (!member) return;
        
        // Apply custom nickname if set
        if (settings.customization.botName && settings.customization.botName !== member.nickname) {
            try {
                await member.setNickname(settings.customization.botName);
                console.log(`✅ Set bot nickname to "${settings.customization.botName}" in ${guild.name}`);
            } catch (err) {
                console.error(`❌ Failed to set nickname in ${guild.name}:`, err.message);
            }
        } else if (!settings.customization.botName && member.nickname) {
            // Reset to default if custom name removed
            try {
                await member.setNickname(null);
                console.log(`✅ Reset bot nickname to default in ${guild.name}`);
            } catch (err) {
                console.error(`❌ Failed to reset nickname in ${guild.name}:`, err.message);
            }
        }
        
        // Note: Avatar cannot be changed per-server (Discord API limitation)
        // Only global avatar can be changed
        
    } catch (error) {
        console.error(`Error applying customization for ${guild.name}:`, error);
    }
}

// When bot joins a new server
client.on('guildCreate', async (guild) => {
    console.log(`✅ Joined new server: ${guild.name} (${guild.id})`);
    
    // Initialize settings for new server
    if (!serverSettings[guild.id]) {
        serverSettings[guild.id] = JSON.parse(JSON.stringify(defaultSettings));
        saveSettings();
    }
    
    // Apply any customization
    await applyServerCustomization(guild);
});

// Message event for XP system and keyword detection
client.on('messageCreate', async (message) => {
    // Quick early returns for performance
    if (message.author.bot) return;
    if (!message.guild) return;
    
    const settings = getGuildSettings(message.guild.id);
    const userId = message.author.id;
    const now = Date.now();
    
    // Track message analytics
    const analytics = initializeAnalyticsData(message.guild.id);
    analytics.messages.total++;
    analytics.messages.byUser[userId] = (analytics.messages.byUser[userId] || 0) + 1;
    analytics.messages.byChannel[message.channel.id] = (analytics.messages.byChannel[message.channel.id] || 0) + 1;
    
    // Track by hour (0-23) and day (0-6)
    const messageDate = new Date(now);
    const hour = messageDate.getHours();
    const day = messageDate.getDay(); // 0 = Sunday, 6 = Saturday
    analytics.messages.byHour[hour]++;
    analytics.messages.byDay[day]++;
    
    saveAnalyticsData();
    
    // Auto-thread channel (1094846351101132872) - Create thread for images, delete text-only messages
    if (message.channel.id === '1094846351101132872') {
        const hasImage = message.attachments.size > 0 && message.attachments.some(att => 
            att.contentType && att.contentType.startsWith('image/')
        );
        
        if (hasImage) {
            try {
                // First, create a new message in the channel that mentions the user
                let newMessage = `📸 Post by ${message.author}`;
                if (message.content) {
                    newMessage += `\n\n${message.content}`;
                }
                
                // Get all image attachments
                const imageAttachments = Array.from(message.attachments.values())
                    .filter(att => att.contentType && att.contentType.startsWith('image/'));
                
                // Send the new message with mention and images
                const mentionMessage = await message.channel.send({
                    content: newMessage,
                    files: imageAttachments.map(att => att.url)
                });
                
                // Create thread from the NEW message (the one with the mention)
                const threadName = `${message.author.username}'s post`;
                await mentionMessage.startThread({
                    name: threadName,
                    autoArchiveDuration: 1440, // 24 hours
                    reason: 'Auto-thread for image post'
                });
                
                // Delete the original message (the one without mention)
                await message.delete();
                
                console.log(`🧵 Created thread "${threadName}" for image post in channel 1094846351101132872`);
            } catch (error) {
                console.error('Error creating thread for image:', error);
            }
        } else {
            // No image - delete message and notify user to use threads
            try {
                await message.delete();
                const reply = await message.channel.send({
                    content: `${message.author}, please don't type in this channel! 📝\n\n**Use the threads** created from image posts to discuss. Post an image to create a new thread, or join an existing thread to chat! 💬`
                });
                
                // Auto-delete the warning after 10 seconds
                setTimeout(() => {
                    reply.delete().catch(() => {});
                }, 10000);
            } catch (error) {
                console.error('Error handling text-only message in auto-thread channel:', error);
            }
            return; // Stop processing this message
        }
    }
    
    // Bot owner mention to unlock AI (priority check)
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
                
                const levelUpMsg = translate(message.guild.id, 'leveling.levelUp', {
                    user: message.author.toString(),
                    level: result.newLevel
                });
                
                const embed = new EmbedBuilder()
                    .setTitle('🎉 Level Up!')
                    .setDescription(levelUpMsg)
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
    
    // AI Chat in designated channel - Optimized (includes ChatGPT channel)
    const isChatGPTChannel = message.channel.id === '1433480720776433664';
    if (settings.ai?.enabled && (message.channel.name === settings.ai.channelName || message.channel.id === settings.ai.channelId || isChatGPTChannel)) {
        if (message.author.bot || !config.deepseekApiKey || config.deepseekApiKey === 'YOUR_DEEPSEEK_API_KEY_HERE') return;
        
        // Don't respond to users in automated message channel
        if (message.channel.id === '920750934085222470') return;
        
        const userId = message.author.id;
        const channelId = message.channel.id;
        const now = Date.now();
        
        // Check user daily token limit (5k per user per day)
        if (hasUserExceededLimit(userId)) {
            const remaining = getUserRemainingTokens(userId);
            return message.reply(`🚫 **Daily AI limit reached!**\n\nYou've used your **5,000 token** daily quota.\n**Remaining:** ${remaining} tokens (resets at midnight)\n\nThis helps keep the bot sustainable for everyone! ⚡`);
        }
        
        // Cooldown check (1 second)
        if (aiCooldowns[userId] && now < aiCooldowns[userId] + 1000) {
            return message.reply(`⏱️ Wait ${((aiCooldowns[userId] + 1000 - now) / 1000).toFixed(1)}s before asking again.`);
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
        
        // Rage bait / troll detection - dismiss obvious bait without long responses
        if (/\b(didnt even|didn't even|cant even|can't even|dont even|don't even|absolute|mate you|bruh|bro you|imagine|literally|unironically|cope|seethe|skill issue|ratio|L \+|cringe|based and|touch grass|go outside)\b/i.test(lowercaseMsg) &&
            /\b(finish|hold|understand|know how|figure out|too dumb|stupid|idiot|noob|bad at|suck at|terrible|trash|garbage)\b/i.test(lowercaseMsg)) {
            return message.reply('Not here to debate mate. Ask a real question if you need help.');
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
        
        // Check if message contains PS3/PS4 error code patterns (allow these through)
        const containsErrorCode = /\b(8[0-9]{7}|[AEF][0-9]{7})\b/i.test(message.content);
        
        // AGGRESSIVE token-wasting detection
        // Block attempts to make AI generate long responses on purpose
        if (!containsErrorCode && (
            // Math/calculation spam
            /\b(prove|proof|calculate|solve|compute|equation|theorem|conjecture|demonstrate|show\s+that|find\s+all|list\s+all|enumerate|factorial|fibonacci|prime\s+number|integration|derivative|matrix|polynomial|algorithm|step\s+by\s+step|explain\s+in\s+detail|mathematical|infinity|summation|sequence|series|permutation|combination)\b/i.test(lowercaseMsg) ||
            /(\d+\s*[\+\-\*\/\^]\s*\d+.*[\+\-\*\/\^].*\d+)|(\d{5,})|([a-z]\s*[\+\-\*\/\^=]\s*[a-z])/i.test(message.content) ||
            // Requests designed to waste tokens
            /\b(write\s+(me\s+)?(a\s+)?(long|detailed|comprehensive|extensive|complete|full|entire|lengthy)|essay|paragraph|story|novel|article|blog|document|report|thesis|summary|analysis|breakdown|walkthrough|encyclopedia|history|timeline)\b/i.test(lowercaseMsg) ||
            /\b(500\s+word|1000\s+word|2000\s+word|[0-9]+\s+word|multiple\s+paragraph|several\s+paragraph|many\s+sentence)\b/i.test(lowercaseMsg) ||
            /\b(use\s+(all|more|lots|many|maximum)\s+(token|word)|token\s+(test|explosion|bomb|waste)|make\s+it\s+long|be\s+verbose|as\s+long\s+as\s+possible|longest\s+response)\b/i.test(lowercaseMsg) ||
            // Sneaky "make it longer" attempts
            /\b(make\s+it\s+(longer|bigger|more)|include\s+(more|all|every|each)\s+(detail|info|information)|add\s+more\s+(detail|info|content|word)|expand\s+on|elaborate\s+on)\b/i.test(lowercaseMsg) ||
            /\b(all\s+the\s+(detail|difference|info|information|spec)|every\s+(detail|difference|aspect|feature)|small\s+detail|minor\s+detail)\b/i.test(lowercaseMsg) ||
            /\b(longer\s+response|more\s+complete|even\s+include|also\s+include\s+how|what\s+files|what\s+drives|how\s+different|all\s+the\s+differences)\b/i.test(lowercaseMsg) ||
            // Repetition/list spam
            /\b(repeat|say\s+again|copy\s+paste|spam|flood)\s+(this|that|it|100|1000|times|words)/i.test(lowercaseMsg) ||
            /\b(list\s+(all|every|100|1000)|tell\s+me\s+everything|give\s+me\s+all|name\s+all|count\s+to\s+(100|1000|10000))\b/i.test(lowercaseMsg) ||
            // Overly long messages
            message.content.length > 500)) {
            return message.reply(translate(message.guild.id, 'ai.tokenBlocked'));
        }
        
        aiCooldowns[userId] = now;
        if (!aiConversations[channelId]) aiConversations[channelId] = [];
        
        // Check response cache first
        const cachedResponse = getCachedResponse(message.content);
        if (cachedResponse) {
            console.log('💾 Using cached response (API call saved)');
            return message.reply(`${cachedResponse}\n\n*💾 Cached response*`);
        }
        
        // Analyze tone and add message
        const userTone = analyzeUserTone(message.content, userId);
        const toneConfig = getPersonalityForTone(userTone, message.author.username);
        
        // Compress message before storing in conversation history
        const compressedUserMsg = compressMessage(`[${message.author.username}]: ${message.content}`);
        aiConversations[channelId].push({
            role: 'user',
            content: compressedUserMsg,
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
                // AGGRESSIVE search detection - search for almost any technical question
                let searchContext = '';
                let searchResults = null;
                const shouldSearch = /\b(latest|recent|current|today|news|what's new|search|look up|find|202[45]|who is|what is|when is|where|download|get|install|jailbreak|hack|exploit|firmware|cfw|ofw|homebrew|pkg|rap|license|tool|app|emulator|ps[12345]|psp|vita|error|code|fix|solve|guide|tutorial|how to|explain|step|instruction|verify|trusted|source|site|website|link|repo|github|update|version|compatible|work|support|available|best|recommend|game|backup)\b/i.test(message.content);
                
                if (shouldSearch) {
                    const results = await searchWeb(message.content);
                    if (results?.length) {
                        searchResults = results.slice(0, 5); // Increased to top 5 for more options
                        // Provide full context to AI including URLs
                        searchContext = '\n\n🔗 VERIFIED SOURCES - YOU MUST INCLUDE THESE LINKS IN YOUR RESPONSE:\n' + searchResults.map((r, i) => 
                            `${i + 1}. ${r.title}\n   ${r.description}\n   🌐 Link: ${r.url}`
                        ).join('\n\n') + '\n\n⚠️ CRITICAL: Always include 2-3 relevant website links in your response. Format links as plain URLs. Users need direct access to download pages, guides, and tools. If discussing tools/games/exploits, include the direct source link from the search results above.';
                    }
                }
                
                // Build message array (strip metadata for token efficiency)
                const messages = [
                    { role: 'system', content: `${settings.ai.systemPrompt}\n\n${toneConfig.instruction}${searchContext}` },
                    ...aiConversations[channelId].map(m => ({ role: m.role, content: m.content }))
                ];
                
                // Smart AI selection - ChatGPT ONLY in channel 1433480720776433664, DeepSeek everywhere else
                const isChatGPTChannelHere = message.channel.id === '1433480720776433664';
                
                let aiProvider, modelName, response;
                
                if (isChatGPTChannelHere && config.openaiApiKey && config.openaiApiKey !== 'YOUR_OPENAI_API_KEY_HERE') {
                    // Use ChatGPT exclusively in the designated channel
                    aiProvider = '🧠 ChatGPT';
                    const openai = createOpenAI({ apiKey: config.openaiApiKey });
                    modelName = 'gpt-4o-mini';
                    response = await generateText({
                        model: openai(modelName),
                        messages,
                        temperature: settings.ai.temperature,
                        maxTokens: toneConfig.maxTokens
                    });
                } else {
                    // Use DeepSeek for all other channels (or fallback if OpenAI key missing)
                    aiProvider = '🤖 ChatGPT';
                    const deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
                    modelName = settings.ai.model;
                    
                    // DeepSeek AGGRESSIVE token limiting - enforce strict output limits
                    const strictMaxTokens = Math.min(toneConfig.maxTokens, 300); // Hard cap at 300
                    
                    response = await generateText({
                        model: deepseek(modelName),
                        messages,
                        temperature: settings.ai.temperature,
                        maxTokens: strictMaxTokens,
                        maxRetries: 1 // Don't retry on failure to save tokens
                    });
                }
                
                const text = response.text;
                // DeepSeek and OpenAI use different token keys - prioritize output/completion tokens ONLY
                const outputTokens = response.usage?.completionTokens || response.usage?.outputTokens || 0;
                const inputTokens = response.usage?.promptTokens || response.usage?.inputTokens || 0;
                const totalTokens = response.usage?.totalTokens || (inputTokens + outputTokens);

                // Track token usage for quota system
                trackTokenUsage(aiProvider, totalTokens);
                trackUserTokenUsage(userId, totalTokens);
                
                // Get quota status
                const quotaStatus = getTokenQuotaStatus();
                const providerQuota = aiProvider.includes('ChatGPT') ? quotaStatus.chatgpt : quotaStatus.deepseek;
                const userRemaining = getUserRemainingTokens(userId);

                // Log token usage with AI provider - show breakdown and quota
                console.log(`🤖 ${aiProvider} (${modelName}) | Input: ${inputTokens} | Output: ${outputTokens} | Total: ${totalTokens} | Words: ${text.split(' ').length}`);
                console.log(`📊 Quota Today: ${providerQuota.dailyUsed} used | Month: ${providerQuota.monthlyUsed} used | Remaining: ${providerQuota.monthlyRemaining}`);
                console.log(`👤 User ${message.author.username}: ${totalTokens} tokens used | ${userRemaining} remaining today`);

                if (!text?.trim()) {
                    return message.reply('❌ Empty response received. Try again!');
                }

                // AGGRESSIVE TRUNCATION: DeepSeek often ignores maxTokens, so enforce word limits
                // Rough estimate: 1 token ≈ 0.75 words, so maxTokens * 0.75 = word limit
                let safeText = text;
                const maxWords = Math.floor(toneConfig.maxTokens * 0.75); // Conservative word limit
                const words = text.split(/\s+/);
                
                if (words.length > maxWords) {
                    safeText = words.slice(0, maxWords).join(' ') + '... *(truncated)*';
                    console.log(`⚠️ Response truncated: ${words.length} words → ${maxWords} words (limit: ${toneConfig.maxTokens} tokens)`);
                }

                // Cache common responses (e.g., "what is jailbreak", FAQs)
                if (message.content.length < 100 && words.length < 200) {
                    cacheResponse(message.content, safeText);
                }
                
                // Compress and add to history
                const compressedResponse = compressMessage(safeText);
                aiConversations[channelId].push({ role: 'assistant', content: compressedResponse, timestamp: now });

                // Send response with OUTPUT token usage only (not total tokens)
                const tokenFooter = aiProvider === '🧠 ChatGPT' 
                    ? `\n\n*🧠 ChatGPT: ${outputTokens} tokens*`
                    : `\n\n*🤖 DeepSeek: ${outputTokens} tokens*`;
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
        // Skip error code detection in AI chat channels
        if (message.channel.id === '1431740126546890843' || message.channel.id === '1433480720776433664') return;
        
        await checkKeywords(message, settings);
    }
});


// Function to check for PS3 and PS4 error codes (optimized with regex cache)
async function checkKeywords(message, settings) {
    try {
        const messageContent = message.content.toUpperCase();
        
        // Only trigger on questions or help requests, not casual mentions
        const isQuestion = messageContent.includes('?') || 
                          messageContent.match(/\b(what|why|how|help|fix|error|issue|problem|getting)\b/i);
        
        if (!isQuestion) return; // Don't trigger on casual error code mentions
        
        // Search PS3 error codes first
        let foundErrorCode = null;
        let errorDatabase = null;
        let consoleType = null;
        
        for (const code of errorCodeKeys) {
            // Check if message contains the PS3 error code (case-insensitive)
            if (messageContent.includes(code.toUpperCase())) {
                foundErrorCode = code;
                errorDatabase = ps3ErrorCodes;
                consoleType = 'PS3';
                break; // Early exit on first match
            }
        }
        
        // If no PS3 code found, check PS4 error codes
        if (!foundErrorCode) {
            const ps4ErrorCodeKeys = Object.keys(ps4ErrorCodes).filter(key => !key.startsWith('_'));
            for (const code of ps4ErrorCodeKeys) {
                if (messageContent.includes(code.toUpperCase())) {
                    foundErrorCode = code;
                    errorDatabase = ps4ErrorCodes;
                    consoleType = 'PS4';
                    break;
                }
            }
        }
        
        if (!foundErrorCode) return;
        
        // Log keyword flag
        await logEvent(message.guild, 'keywordFlag', {
            user: message.author.tag,
            userId: message.author.id,
            channelId: message.channel.id,
            keyword: `${consoleType} ${foundErrorCode}`,
            content: message.content,
            messageUrl: message.url
        });
        
        // Get error description from database
        const errorDescription = errorDatabase[foundErrorCode];
        
        // Get pre-computed category for PS3 (or use default for PS4)
        let categoryInfo = { name: `🎮 ${consoleType} Error`, color: 0x0099FF };
        if (consoleType === 'PS3') {
            categoryInfo = errorCodeCategories.get(foundErrorCode) || categoryInfo;
        }
        
        const errorEmbed = new EmbedBuilder()
            .setTitle(`❓ ${consoleType} Error Code: ${foundErrorCode}`)
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
    
    // Check for pending Sellix purchases
    if (pendingPurchases[member.id] && pendingPurchases[member.id].guildId === member.guild.id) {
        const purchase = pendingPurchases[member.id];
        console.log(`🎁 Processing pending purchase for ${member.user.tag}`);
        
        try {
            // Assign role
            const role = member.guild.roles.cache.get(config.sellixRoleId);
            if (role) {
                await member.roles.add(role);
                console.log(`✅ Assigned pending purchase role to ${member.user.tag}`);
                
                // Send DM
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('✅ Purchase Activated!')
                        .setDescription(`Welcome to the server! Your previous purchase has been activated and you've been given access to **${role.name}**.`)
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '🆔 Order ID', value: purchase.orderId, inline: true },
                            { name: '💰 Amount Paid', value: `$${purchase.amount}`, inline: true }
                        )
                        .setFooter({ text: member.guild.name })
                        .setTimestamp();
                    
                    await member.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log('Could not DM user:', error.message);
                }
                
                // Log activation
                const logChannel = member.guild.channels.cache.get(config.sellixLogChannelId);
                if (logChannel) {
                    const activationEmbed = new EmbedBuilder()
                        .setTitle('✅ Pending Purchase Activated')
                        .setColor(0x00FF00)
                        .setDescription('User joined server and role was automatically assigned.')
                        .addFields(
                            { name: '👤 Customer', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                            { name: '🆔 Order ID', value: purchase.orderId, inline: true },
                            { name: '💰 Amount', value: `$${purchase.amount}`, inline: true },
                            { name: '📧 Email', value: purchase.email || 'N/A', inline: false },
                            { name: '🎁 Role Given', value: role.name, inline: false },
                            { name: '📦 Product', value: purchase.product || 'Unknown', inline: false }
                        )
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [activationEmbed] });
                }
            }
            
            // Remove from pending
            delete pendingPurchases[member.id];
            savePendingPurchases();
        } catch (error) {
            console.error('Error processing pending purchase:', error);
        }
    }
    
    // Track member join in analytics
    const analytics = initializeAnalyticsData(member.guild.id);
    analytics.members.joins.push({
        userId: member.id,
        username: member.user.tag,
        timestamp: Date.now()
    });
    analytics.members.currentCount = member.guild.memberCount;
    saveAnalyticsData();
    
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
            : `Welcome ${member.toString()}! We're glad to have you here in ${member.guild.name}!`;
        
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('👋 Welcome to the Server!')
            .setDescription(description)
            .setColor(0x00FF00)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '📖 Getting Started', value: 'Check out our rules and guidelines', inline: false },
                { name: '💬 Chat', value: 'Feel free to chat and ask questions', inline: false },
                { name: '👥 Community', value: `You are member #${member.guild.memberCount}`, inline: false }
            )
            .setFooter({ text: member.guild.name })
            .setTimestamp();
        
        welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
    initializeUser(member.user.id);
});

// Member leave event
client.on('guildMemberRemove', (member) => {
    const settings = getGuildSettings(member.guild.id);
    
    // Track member leave in analytics
    const analytics = initializeAnalyticsData(member.guild.id);
    analytics.members.leaves.push({
        userId: member.id,
        username: member.user.tag,
        timestamp: Date.now()
    });
    analytics.members.currentCount = member.guild.memberCount;
    saveAnalyticsData();
    
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
    
    if (!settings.leave.enabled) {
        console.log(`[Leave] Leave messages disabled for ${member.guild.name}`);
        return;
    }
    
    console.log(`[Leave] Looking for channel: "${settings.leave.channelName}" in ${member.guild.name}`);
    
    const leaveChannel = findChannel(member.guild, settings.leave.channelName) 
        || findChannel(member.guild, 'general') 
        || findChannel(member.guild, 'goodbye');
    
    if (!leaveChannel) {
        console.log(`[Leave] ❌ No leave channel found! Tried: "${settings.leave.channelName}", "general", "goodbye"`);
        console.log(`[Leave] Available channels:`, member.guild.channels.cache.filter(ch => ch.type === 0).map(ch => ch.name).join(', '));
        return;
    }
    
    console.log(`[Leave] ✅ Found leave channel: ${leaveChannel.name}`);
    
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
            .setFooter({ text: member.guild.name })
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
            // Track command usage in analytics
            if (interaction.guild) {
                const analytics = initializeAnalyticsData(interaction.guild.id);
                analytics.commands.total++;
                analytics.commands.byCommand[interaction.commandName] = (analytics.commands.byCommand[interaction.commandName] || 0) + 1;
                saveAnalyticsData();
            }
            
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
            .setFooter({ text: 'Multi-Purpose Bot • Use /features for more info' })
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
    
    // Power Options Panel (Bot Owner only)
    if (interaction.commandName === 'poweroptions') {
        // Check if user is bot owner
        if (interaction.user.id !== config.botOwnerId) {
            return interaction.reply({ content: '❌ Only the bot owner can use this command!', ephemeral: true });
        }
        
        const uptime = Math.floor(process.uptime());
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        const powerEmbed = new EmbedBuilder()
            .setTitle('⚡ Bot Power Management')
            .setDescription('Control bot power state and updates')
            .setColor(0x00BFFF)
            .addFields(
                { name: '⏱️ Uptime', value: uptimeStr, inline: true },
                { name: '💾 Memory', value: `${memoryUsage} MB`, inline: true },
                { name: '📊 Status', value: '🟢 Online', inline: true }
            )
            .setFooter({ text: 'Choose an option below' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('power_update')
                    .setLabel('Update & Restart')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('power_restart')
                    .setLabel('Restart')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('♻️'),
                new ButtonBuilder()
                    .setCustomId('power_shutdown')
                    .setLabel('Shutdown')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
            );
        
        await interaction.reply({ embeds: [powerEmbed], components: [row], ephemeral: true });
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
        
        // YouTube status - hardcoded as enabled since it's functional
        const youtubeEnabled = true;
        
        const featuresEmbed = new EmbedBuilder()
            .setTitle('🌟 PSHomebrew Bot - Features')
            .setDescription('Welcome to the PSHomebrew Discord Bot! Here\'s everything this bot can do.')
            .setColor(0x00FF88)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '⭐',
                    value: `**Leveling System**\n${settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nEarn **${settings.leveling.minXP}-${settings.leveling.maxXP} XP** per message\n**${settings.leveling.cooldown / 1000}s** cooldown\n**${settings.leveling.maxLevel} levels** total`,
                    inline: true
                },
                {
                    name: '🎮',
                    value: `**Error Codes**\n${settings.keywords.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nDetects **351 PS3 + PS4** codes\nAuto-explains instantly\nExample: \`80710016\``,
                    inline: true
                },
                {
                    name: '🤖',
                    value: `**AI Chat**\n${settings.ai?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nDeepSeek + ChatGPT\n5k tokens/user/day\nResponse caching`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '👋',
                    value: `**Welcome Messages**\n${settings.welcome.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nChannel: **#${settings.welcome.channelName}**\n${settings.welcome.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                },
                {
                    name: '�',
                    value: `**Leave Messages**\n${settings.leave.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nChannel: **#${settings.leave.channelName}**\n${settings.leave.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                },
                {
                    name: '🎫',
                    value: `**Ticket System**\n${settings.tickets?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nSupport ticket management\nUse **/setuptickets**\nStaff and user panels`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '🛡️',
                    value: `**Raid Protection**\n${settings.raidProtection?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nAuto-kick spam accounts\nNew account detection\nMass join protection`,
                    inline: true
                },
                {
                    name: '✏️',
                    value: `**Auto Nickname**\n${settings.autoNickname?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nPrefix: **${settings.autoNickname?.prefix || 'PS'}**\nAuto-rename on join\nKeeps names organized`,
                    inline: true
                },
                {
                    name: '📺',
                    value: `**YouTube Notifs**\n✅ Enabled\n\nNew video alerts\nUse **/youtubenotifications**\nAuto-post to channel`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '📊',
                    value: `**Server Stats**\n${settings.serverStats?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nLive member counter\nAuto-updating channels\nMember/bot statistics`,
                    inline: true
                },
                {
                    name: '💬',
                    value: `**Custom Commands**\nAlways Available\n\nClickable server commands\nUse **/pcommands**\nAdd/edit/remove easily`,
                    inline: true
                },
                {
                    name: '📝',
                    value: `**Moderation Logging**\n${settings.logging?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\nTracks all mod actions\nBans, kicks, timeouts\nAudit trail for staff`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '🌍',
                    value: `**Multi-Language**\n✅ Available\n\n6 languages supported\nUse **/language**\nEN, ES, FR, DE, PT, JA`,
                    inline: true
                },
                {
                    name: '💾',
                    value: `**AI Caching**\n✅ Active\n\n30-50% API savings\n40-60% storage savings\nFaster responses`,
                    inline: true
                },
                {
                    name: '🎨',
                    value: `**Bot Customization**\n✅ Available\n\nCustom server nicknames\nUse **/botcustom**\nPer-server branding`,
                    inline: true
                }
            )
            .setFooter({ text: 'Use /viewsettings to see all server settings • /aistats for token usage' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [featuresEmbed], ephemeral: true });
    }
    
    // Server Features command - Anyone with role can view
    if (interaction.commandName === 'serverfeatures') {
        const allowedRoleId = '920779112270946384';
        const hasRole = interaction.member.roles.cache.has(allowedRoleId);
        const isOwner = interaction.user.id === config.botOwnerId;
        
        if (!hasRole && !isOwner) {
            return interaction.reply({ content: '❌ You need the staff role to view features.', ephemeral: true });
        }
        
        const settings = getGuildSettings(interaction.guild.id);
        const youtubeEnabled = true;
        
        const featuresEmbed = new EmbedBuilder()
            .setTitle('🌟 PSHomebrew Bot - Features')
            .setDescription('Welcome to the PSHomebrew Discord Bot! Here\'s everything this bot can do.')
            .setColor(0x00FF88)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '⭐ Leveling System',
                    value: `🚀 **Gamified progression system**\n\nReward active members automatically\nUnlock roles as you rank up`,
                    inline: true
                },
                {
                    name: '🎮 Error Codes',
                    value: `🔍 **Instant PS3/PS4 code lookup**\n\n351 error codes in database\nAutomated troubleshooting assistant`,
                    inline: true
                },
                {
                    name: '🤖 AI Chat',
                    value: `🧠 **Powered by DeepSeek AI + ChatGPT**\n\nPS homebrew expert assistance\nSmart contextual responses\n5k tokens per user daily`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '👋 Welcome Messages',
                    value: `✨ **Professional member onboarding**\n\nFully customizable greetings\nMake great first impressions`,
                    inline: true
                },
                {
                    name: '📭 Leave Messages',
                    value: `💫 **Elegant farewell system**\n\nCustom goodbye messages\nTrack member departures`,
                    inline: true
                },
                {
                    name: '🎫 Ticket System',
                    value: `🎯 **Advanced support platform**\n\nOrganized help desk solution\nProfessional ticket management`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '🛡️ Raid Protection',
                    value: `⚔️ **Military-grade server defense**\n\nAI-powered spam detection\nReal-time threat neutralization`,
                    inline: true
                },
                {
                    name: '✏️ Auto Nickname',
                    value: `🏷️ **Smart member branding**\n\nAutomatic **PS** prefix system\nProfessional server identity`,
                    inline: true
                },
                {
                    name: '📺 YouTube Notifs',
                    value: `🎬 **Content update alerts**\n\nInstant new video notifications\nNever miss an upload`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '📊 Server Stats',
                    value: `📈 **Real-time analytics dashboard**\n\nLive member tracking\nDynamic voice channel stats`,
                    inline: true
                },
                {
                    name: '💬 Custom Commands',
                    value: `⚡ **Interactive command builder**\n\nCreate clickable buttons\nNo coding required`,
                    inline: true
                },
                {
                    name: '📝 Moderation Logging',
                    value: `📋 **Complete audit system**\n\nFull action history tracking\nAccountability & transparency`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: false
                },
                {
                    name: '🌍 Multi-Language',
                    value: `🗣️ **Global language support**\n\n6 languages available\nEN, ES, FR, DE, PT, JA\nServer-wide translation`,
                    inline: true
                },
                {
                    name: '💾 AI Optimization',
                    value: `⚡ **Performance & efficiency**\n\nResponse caching system\n30-50% API cost reduction\n5k tokens per user daily`,
                    inline: true
                },
                {
                    name: '🎨 Bot Customization',
                    value: `🎭 **Per-server branding**\n\nCustom bot nicknames\nProfessional server identity\nPersonalized experience`,
                    inline: true
                }
            )
            .setFooter({ text: 'Use /viewsettings to see all server settings • /aistats for AI token tracking' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [featuresEmbed], ephemeral: true });
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
    
    // Set Welcome Channel command

    
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
        
        // Check user daily token limit (5k per user per day)
        if (hasUserExceededLimit(userId)) {
            const remaining = getUserRemainingTokens(userId);
            return interaction.reply({
                content: `🚫 **Daily AI limit reached!**\n\nYou've used your **5,000 token** daily quota.\n**Remaining:** ${remaining} tokens (resets at midnight)\n\nThis helps keep the bot sustainable for everyone! ⚡`,
                ephemeral: true
            });
        }
        
        // Check response cache first
        const cachedResponse = getCachedResponse(userMessage);
        if (cachedResponse) {
            console.log('💾 Using cached response (API call saved)');
            return interaction.reply(`${cachedResponse}\n\n*💾 Cached response*`);
        }
        
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
        
        // Token-heavy request detection (math problems, proofs, complex calculations)
        const lowercaseMsg = userMessage.toLowerCase();
        if (/\b(prove|proof|calculate|solve|compute|equation|theorem|conjecture|demonstrate|show\s+that|find\s+all|list\s+all|enumerate|factorial|fibonacci|prime\s+number|integration|derivative|matrix|polynomial|algorithm|step\s+by\s+step|explain\s+in\s+detail|mathematical|infinity|summation|sequence|series|permutation|combination)\b/i.test(lowercaseMsg) ||
            /(\d+\s*[\+\-\*\/\^]\s*\d+.*[\+\-\*\/\^].*\d+)|(\d{5,})|([a-z]\s*[\+\-\*\/\^=]\s*[a-z])/i.test(userMessage) ||
            userMessage.length > 500) {
            return interaction.reply({
                content: translate(interaction.guild.id, 'ai.tokenBlocked'),
                ephemeral: true 
            });
        }
        
        // Analyze user's conversation tone
        const userTone = analyzeUserTone(userMessage, userId);
        const toneConfig = getPersonalityForTone(userTone, interaction.user.username);
        
        // Initialize conversation history for this channel
        if (!aiConversations[channelId]) {
            aiConversations[channelId] = [];
        }
        
        // Compress and add user message to history with userId for context
        const compressedUserMsg = compressMessage(`[${interaction.user.username}]: ${userMessage}`);
        aiConversations[channelId].push({
            role: 'user',
            content: compressedUserMsg,
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
                    // Limit to top 2 results and truncate descriptions for faster processing
                    searchContext = '\n\nSEARCH RESULTS:\n' +
                        searchResults.slice(0, 2).map((r, i) => 
                            `${i + 1}. ${r.title}\n${r.description.substring(0, 100)}...\n${r.url}`
                        ).join('\n\n') +
                        '\n\nBriefly reference sources if used.';
                }
            }
            
            // Build optimized message array
            // Load latest CFW knowledge
            const cfwKnowledge = loadJSON('./cfwKnowledge.json', {});
            const cfwInfo = cfwKnowledge.evilnatCFW 
                ? `Current CFW Info: Evilnat ${cfwKnowledge.evilnatCFW.latestVersion} is the latest version (updated ${new Date(cfwKnowledge.lastUpdated).toLocaleDateString()}).` 
                : '';
            
            const messages = [
                {
                    role: 'system',
                    content: `${settings.ai.systemPrompt} ${cfwInfo}\n\n${toneConfig.instruction}${searchContext}`
                },
                // Only send content, not metadata (saves tokens)
                ...aiConversations[channelId].map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            ];
            
            // Use @ai-sdk/deepseek for DeepSeek API with dynamic token limit
            const deepseek = createDeepSeek({ apiKey: config.deepseekApiKey });
            let aiResponse = '';
            
            try {
                const completion = await deepseek.chat.completions.create({
                    model: settings.ai.model,
                    messages: messages,
                    temperature: settings.ai.temperature,
                    max_tokens: toneConfig.maxTokens
                });
                
                aiResponse = completion.choices[0]?.message?.content;
                
                // Track token usage
                const tokensUsed = completion.usage?.total_tokens || 0;
                const inputTokens = completion.usage?.prompt_tokens || 0;
                const outputTokens = completion.usage?.completion_tokens || 0;
                
                trackTokenUsage('DeepSeek', tokensUsed);
                trackUserTokenUsage(userId, tokensUsed);
                const quotaStatus = getTokenQuotaStatus();
                const userRemaining = getUserRemainingTokens(userId);
                
                console.log(`🤖 DeepSeek (${settings.ai.model}) | Input: ${inputTokens} | Output: ${outputTokens} | Total: ${tokensUsed}`);
                console.log(`📊 Quota Today: ${quotaStatus.deepseek.dailyUsed} used | Month: ${quotaStatus.deepseek.monthlyUsed} used | Remaining: ${quotaStatus.deepseek.monthlyRemaining}`);
                console.log(`👤 User ${interaction.user.username}: ${tokensUsed} tokens used | ${userRemaining} remaining today`);
                
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
            
            // Cache common responses and compress before storing
            if (userMessage.length < 100 && aiResponse.length < 800) {
                cacheResponse(userMessage, aiResponse);
            }
            
            // Compress and add AI response to history
            const compressedResponse = compressMessage(aiResponse);
            aiConversations[channelId].push({
                role: 'assistant',
                content: compressedResponse,
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
    
    // AI Stats command - Display token quota usage
    if (interaction.commandName === 'aistats') {
        const userId = interaction.user.id;
        const isAdmin = interaction.member.permissions.has('Administrator');
        
        const quotaStatus = getTokenQuotaStatus();
        checkAndResetUserQuota(userId);
        const userUsed = userTokenQuota[userId]?.dailyUsed || 0;
        const userRemaining = USER_DAILY_LIMIT - userUsed;
        
        const embed = new EmbedBuilder()
            .setTitle('📊 AI Token Usage Statistics')
            .setColor(0x00D9FF)
            .setDescription('Current token consumption for DeepSeek and ChatGPT')
            .addFields(
                { name: '\u200B', value: '**👤 Your Personal Usage**', inline: false },
                { 
                    name: '📅 Today', 
                    value: `Used: **${userUsed.toLocaleString()}** / **5,000** tokens\nRemaining: **${userRemaining.toLocaleString()}** tokens\n${userRemaining < 1000 ? '⚠️ Running low!' : '✅ Plenty left!'}`,
                    inline: false 
                }
            );
        
        // Add server-wide stats for admins only
        if (isAdmin) {
            embed.addFields(
                { name: '\u200B', value: '\u200B', inline: false }, // Spacer
                { name: '\u200B', value: '**🤖 DeepSeek (Server-Wide)**', inline: false },
                { 
                    name: '📅 Today', 
                    value: `Used: **${quotaStatus.deepseek.dailyUsed.toLocaleString()}** tokens\nRemaining: **${quotaStatus.deepseek.dailyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.deepseek.dailyRemaining.toLocaleString()}**`,
                    inline: true 
                },
                { 
                    name: '📆 This Month', 
                    value: `Used: **${quotaStatus.deepseek.monthlyUsed.toLocaleString()}** tokens\nRemaining: **${quotaStatus.deepseek.monthlyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.deepseek.monthlyRemaining.toLocaleString()}**`,
                    inline: true 
                },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                { name: '\u200B', value: '**🧠 ChatGPT (Server-Wide)**', inline: false },
                { 
                    name: '📅 Today', 
                    value: `Used: **${quotaStatus.chatgpt.dailyUsed.toLocaleString()}** tokens\nRemaining: **${quotaStatus.chatgpt.dailyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.chatgpt.dailyRemaining.toLocaleString()}**`,
                    inline: true 
                },
                { 
                    name: '📆 This Month', 
                    value: `Used: **${quotaStatus.chatgpt.monthlyUsed.toLocaleString()}** tokens\nRemaining: **${quotaStatus.chatgpt.monthlyRemaining === 'Unlimited' ? 'Unlimited ♾️' : quotaStatus.chatgpt.monthlyRemaining.toLocaleString()}**`,
                    inline: true 
                },
                { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                { 
                    name: '💾 Cache Performance', 
                    value: `Cached responses: **${responseCache.size}**/100\nAPI calls saved: **~${Math.round(responseCache.size * 0.3)}**`,
                    inline: false 
                }
            );
            embed.setFooter({ text: 'Admin view: Server-wide statistics | User limit: 5,000 tokens/day' });
        } else {
            embed.setFooter({ text: 'Your personal usage | Daily limit: 5,000 tokens (resets at midnight)' });
        }
        
        embed.setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    // Bot Customization command
    if (interaction.commandName === 'botcustom') {
        if (!requireAdmin(interaction)) return;
        
        const subcommand = interaction.options.getSubcommand();
        const settings = getGuildSettings(interaction.guild.id);
        
        if (!settings.customization) {
            settings.customization = defaultSettings.customization;
        }
        
        if (subcommand === 'view') {
            const embed = new EmbedBuilder()
                .setTitle('🎨 Bot Customization Settings')
                .setColor(0x5865F2)
                .setDescription('Current bot customization for this server')
                .addFields(
                    { 
                        name: '📝 Bot Nickname', 
                        value: settings.customization.botName || '*Using default name*',
                        inline: false 
                    },
                    {
                        name: 'ℹ️ Note',
                        value: 'Bot avatar cannot be changed per-server (Discord limitation).\nOnly the nickname can be customized per server.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Use /botcustom name to change the bot nickname' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        if (subcommand === 'name') {
            const nickname = interaction.options.getString('nickname');
            
            if (!nickname) {
                // Reset to default
                settings.customization.botName = null;
                saveSettings();
                await applyServerCustomization(interaction.guild);
                
                return interaction.reply({
                    content: '✅ Bot nickname reset to default!',
                    ephemeral: true
                });
            }
            
            // Validate nickname length
            if (nickname.length > 32) {
                return interaction.reply({
                    content: '❌ Nickname must be 32 characters or less!',
                    ephemeral: true
                });
            }
            
            // Set custom nickname
            settings.customization.botName = nickname;
            saveSettings();
            await applyServerCustomization(interaction.guild);
            
            return interaction.reply({
                content: `✅ Bot nickname changed to **${nickname}**!`,
                ephemeral: true
            });
        }
    }
    
    // AI Setup command - Interactive Panel
    if (interaction.commandName === 'ai') {
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
    // Analytics command
    if (interaction.commandName === 'analytics') {
        if (!requireAdmin(interaction)) return;
        
        const analytics = initializeAnalyticsData(interaction.guild.id);
        const now = Date.now();
        const daysSinceStart = Math.floor((now - analytics.startDate) / (1000 * 60 * 60 * 24));
        const daysSinceReset = Math.floor((now - analytics.lastReset) / (1000 * 60 * 60 * 24));
        
        // Get top 5 most active users
        const topUsers = Object.entries(analytics.messages.byUser)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        const userPromises = topUsers.map(([userId]) => 
            client.users.fetch(userId).catch(() => null)
        );
        const users = await Promise.all(userPromises);
        
        let topUsersText = '';
        for (let i = 0; i < topUsers.length; i++) {
            const [userId, count] = topUsers[i];
            const user = users[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const username = user ? user.tag : 'Unknown User';
            topUsersText += `${medal} **${username}** - ${count.toLocaleString()} messages\n`;
        }
        
        // Get top 3 most active channels
        const topChannels = Object.entries(analytics.messages.byChannel)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        
        let topChannelsText = '';
        for (let i = 0; i < topChannels.length; i++) {
            const [channelId, count] = topChannels[i];
            const channel = interaction.guild.channels.cache.get(channelId);
            topChannelsText += `${i + 1}. ${channel ? `<#${channelId}>` : 'Unknown Channel'} - ${count.toLocaleString()} messages\n`;
        }
        
        // Calculate hourly activity peak
        const peakHour = analytics.messages.byHour.indexOf(Math.max(...analytics.messages.byHour));
        const peakHourFormatted = peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`;
        
        // Calculate daily activity peak
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const peakDay = analytics.messages.byDay.indexOf(Math.max(...analytics.messages.byDay));
        
        // Calculate member growth
        const joinsLast7Days = analytics.members.joins.filter(j => (now - j.timestamp) < (7 * 24 * 60 * 60 * 1000)).length;
        const leavesLast7Days = analytics.members.leaves.filter(l => (now - l.timestamp) < (7 * 24 * 60 * 60 * 1000)).length;
        const netGrowth = joinsLast7Days - leavesLast7Days;
        
        // Top commands
        const topCommands = Object.entries(analytics.commands.byCommand)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        let topCommandsText = '';
        for (let i = 0; i < topCommands.length; i++) {
            const [command, count] = topCommands[i];
            topCommandsText += `${i + 1}. \`/${command}\` - ${count.toLocaleString()} uses\n`;
        }
        
        const analyticsEmbed = new EmbedBuilder()
            .setTitle('📊 Server Analytics Dashboard')
            .setDescription(`Comprehensive server statistics and insights`)
            .setColor(0x5865F2)
            .addFields(
                { 
                    name: '💬 Message Activity', 
                    value: `**Total Messages:** ${analytics.messages.total.toLocaleString()}\n` +
                           `**Peak Hour:** ${peakHourFormatted}\n` +
                           `**Peak Day:** ${days[peakDay]}`,
                    inline: true
                },
                { 
                    name: '👥 Member Growth (7 Days)', 
                    value: `**Joins:** ${joinsLast7Days}\n` +
                           `**Leaves:** ${leavesLast7Days}\n` +
                           `**Net Growth:** ${netGrowth >= 0 ? '+' : ''}${netGrowth}\n` +
                           `**Current:** ${analytics.members.currentCount}`,
                    inline: true
                },
                { 
                    name: '🎮 Command Usage', 
                    value: `**Total Commands:** ${analytics.commands.total.toLocaleString()}`,
                    inline: true
                },
                { 
                    name: '🏆 Top Active Users', 
                    value: topUsersText || 'No data yet',
                    inline: false
                },
                { 
                    name: '📺 Top Active Channels', 
                    value: topChannelsText || 'No data yet',
                    inline: false
                },
                { 
                    name: '⭐ Most Used Commands', 
                    value: topCommandsText || 'No commands used yet',
                    inline: false
                }
            )
            .setFooter({ 
                text: `Tracking since ${new Date(analytics.startDate).toLocaleDateString()} • ${daysSinceStart} days of data` 
            })
            .setTimestamp();
        
        await interaction.reply({ embeds: [analyticsEmbed] });
    }
    
    // Welcome command - Interactive Panel
    // Welcome Setup command - Interactive Panel
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
    
    // Ticket command - Interactive ticket creation panel
    if (interaction.commandName === 'ticket') {
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        
        // Check if ticket system is enabled
        if (!ticketData[guildId].settings.enabled) {
            // If admin, show setup panel
            if (interaction.member.permissions.has('Administrator')) {
                const settings = ticketData[guildId].settings;
                const staffRole = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set';
                
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket System Control Panel')
                    .setColor(0xFF0000)
                    .setDescription(
                        `System is currently **❌ Disabled**\n\n` +
                        `Manage your server's support ticket system.\n\n` +
                        `Click the buttons below to configure ticket settings.`
                    )
                    .addFields(
                        { name: '📡 Status', value: '❌ Disabled', inline: true },
                        { name: '👮 Staff Role', value: staffRole, inline: true },
                        { name: '📁 Category', value: settings.categoryName, inline: true },
                        { name: '🎫 Total Tickets', value: ticketData[guildId].counter.toString(), inline: true },
                        { name: '📝 Welcome Message', value: settings.ticketMessage.substring(0, 100) + '...', inline: false },
                        { name: '🔒 Close Message', value: settings.closedMessage.substring(0, 100) + '...', inline: false }
                    )
                    .setFooter({ text: 'Click buttons below to configure ticket system' })
                    .setTimestamp();
                
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_toggle')
                            .setLabel('Enable System')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId('ticket_staffrole')
                            .setLabel('Set Staff Role')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('👮'),
                        new ButtonBuilder()
                            .setCustomId('ticket_category')
                            .setLabel('Set Category')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📁'),
                        new ButtonBuilder()
                            .setCustomId('ticket_panel')
                            .setLabel('Create Panel')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🎫')
                    );
                
                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_welcomemsg')
                            .setLabel('Welcome Message')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📝'),
                        new ButtonBuilder()
                            .setCustomId('ticket_closemsg')
                            .setLabel('Close Message')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔒'),
                        new ButtonBuilder()
                            .setCustomId('ticket_refresh')
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔄')
                    );
                
                return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
            }
            
            // For non-admins, show disabled message
            return interaction.reply({ 
                content: '❌ The ticket system is not enabled on this server. Please ask an administrator to enable it using `/ticketsetup`!', 
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

    // Leveling Setup command - Interactive panel
    if (interaction.commandName === 'leveling') {
        if (!requireAdmin(interaction)) return;
        
        const guildId = interaction.guild.id;
        const settings = getGuildSettings(guildId);
        
        // Create interactive panel
        const embed = new EmbedBuilder()
            .setTitle('📊 Leveling System Control Panel')
            .setColor(settings.leveling.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Manage your server's leveling system.\n\n` +
                `Click the buttons below to configure leveling settings.`
            )
            .addFields(
                { name: '📡 Status', value: settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '⚡ XP Range', value: `${settings.leveling.minXP}-${settings.leveling.maxXP}`, inline: true },
                { name: '⏱️ Cooldown', value: `${settings.leveling.cooldown / 1000}s`, inline: true },
                { name: '🔝 Max Level', value: settings.leveling.maxLevel.toString(), inline: true },
                { name: '📢 Level Up Channel', value: settings.leveling.levelUpChannelId ? `<#${settings.leveling.levelUpChannelId}>` : 'Current Channel', inline: true },
                { name: '🎭 Level Roles', value: Object.keys(settings.leveling.levelRoles).length > 0 ? `${Object.keys(settings.leveling.levelRoles).length} roles configured` : 'None', inline: true }
            )
            .setFooter({ text: 'Click buttons below to configure leveling system' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leveling_toggle')
                    .setLabel(settings.leveling.enabled ? 'Disable System' : 'Enable System')
                    .setStyle(settings.leveling.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(settings.leveling.enabled ? '❌' : '✅'),
                new ButtonBuilder()
                    .setCustomId('leveling_xprange')
                    .setLabel('Set XP Range')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚡'),
                new ButtonBuilder()
                    .setCustomId('leveling_cooldown')
                    .setLabel('Set Cooldown')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('leveling_maxlevel')
                    .setLabel('Set Max Level')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔝')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leveling_channel')
                    .setLabel('Level Up Channel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📢'),
                new ButtonBuilder()
                    .setCustomId('leveling_addrole')
                    .setLabel('Add Level Role')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('leveling_removerole')
                    .setLabel('Remove Level Role')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('➖'),
                new ButtonBuilder()
                    .setCustomId('leveling_viewroles')
                    .setLabel('View Roles')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        return;
    }

    // Leave Setup command - Interactive panel
    if (interaction.commandName === 'leave') {
        const leaveCommand = require('./commands/leave.js');
        await leaveCommand.execute(interaction);
        return;
    }

    // Keyword Setup command - Interactive panel
    if (interaction.commandName === 'keyword') {
        const keywordCommand = require('./commands/keyword.js');
        await keywordCommand.execute(interaction);
        return;
    }

    // PCommands command - Interactive panel
    if (interaction.commandName === 'pcommands') {
        const pcommandsCommand = require('./commands/pcommands.js');
        await pcommandsCommand.execute(interaction);
        return;
    }

    // AI Setup command - Interactive panel
    if (interaction.commandName === 'ai') {
        const aiCommand = require('./commands/ai.js');
        await aiCommand.execute(interaction);
        return;
    }

    // Ticket Setup command - Interactive panel
    if (interaction.commandName === 'ticket') {
        if (!requireAdmin(interaction)) return;
        
        const guildId = interaction.guild.id;
        initializeTicketSystem(guildId);
        const settings = ticketData[guildId].settings;
        
        const staffRole = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set';
        
        // Create interactive panel
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ticket System Control Panel')
            .setColor(settings.enabled ? 0x00FF00 : 0xFF0000)
            .setDescription(
                `System is currently **${settings.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                `Manage your server's support ticket system.\n\n` +
                `Click the buttons below to configure ticket settings.`
            )
            .addFields(
                { name: '📡 Status', value: settings.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: '👮 Staff Role', value: staffRole, inline: true },
                { name: '📁 Category', value: settings.categoryName, inline: true },
                { name: '🎫 Total Tickets', value: ticketData[guildId].counter.toString(), inline: true },
                { name: '📝 Welcome Message', value: settings.ticketMessage.substring(0, 100) + '...', inline: false },
                { name: '🔒 Close Message', value: settings.closedMessage.substring(0, 100) + '...', inline: false }
            )
            .setFooter({ text: 'Click buttons below to configure ticket system' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_toggle')
                    .setLabel(settings.enabled ? 'Disable System' : 'Enable System')
                    .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(settings.enabled ? '❌' : '✅'),
                new ButtonBuilder()
                    .setCustomId('ticket_staffrole')
                    .setLabel('Set Staff Role')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👮'),
                new ButtonBuilder()
                    .setCustomId('ticket_category')
                    .setLabel('Set Category')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📁'),
                new ButtonBuilder()
                    .setCustomId('ticket_panel')
                    .setLabel('Create Panel')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_welcomemsg')
                    .setLabel('Welcome Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('ticket_closemsg')
                    .setLabel('Close Message')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('ticket_refresh')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
    }

    // Webhook Setup command - Interactive panel
    if (interaction.commandName === 'webhook') {
        if (!requireAdmin(interaction)) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🔗 Webhook Creator Panel')
            .setColor(0x5865F2)
            .setDescription(
                `Create professional webhook embeds with custom content.\n\n` +
                `**Features:**\n` +
                `• Custom titles, descriptions, and fields\n` +
                `• Image and thumbnail support\n` +
                `• Color customization\n` +
                `• Footer and timestamp options\n` +
                `• Save and reuse templates\n\n` +
                `Click the buttons below to get started.`
            )
            .addFields(
                { name: '📝 Create Webhook', value: 'Set up a new webhook in any channel', inline: true },
                { name: '🎨 Custom Embed', value: 'Design your embed with interactive forms', inline: true },
                { name: '📋 Templates', value: 'Save frequently used embed designs', inline: true }
            )
            .setFooter({ text: 'Webhook Creator • Admin Only' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('webhook_create')
                    .setLabel('Create Webhook')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔗'),
                new ButtonBuilder()
                    .setCustomId('webhook_embed')
                    .setLabel('Design Embed')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎨'),
                new ButtonBuilder()
                    .setCustomId('webhook_list')
                    .setLabel('List Webhooks')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋')
            );
        
        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // Moderator command - Interactive panel
    if (interaction.commandName === 'moderator') {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(interaction.guild.id);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        // Create interactive panel
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Moderation Control Panel')
            .setColor(0x3498DB)
            .setDescription(
                `Complete moderation toolkit for your server.\n\n` +
                `**Quick Actions:**\n` +
                `Use the buttons below to perform moderation actions.`
            )
            .addFields(
                { name: '⚠️ Warn', value: 'Issue a warning to a user', inline: true },
                { name: '🔇 Timeout', value: 'Timeout a user temporarily', inline: true },
                { name: '👢 Kick', value: 'Kick a user from server', inline: true },
                { name: '🔨 Ban', value: 'Permanently ban a user', inline: true },
                { name: '🔕 Mute', value: 'Mute a user in channels', inline: true },
                { name: '🔊 Unmute', value: 'Remove mute from a user', inline: true },
                { name: '📋 Infractions', value: 'View user\'s infraction history', inline: true },
                { name: '🧹 Clear Warnings', value: 'Clear all warnings for a user', inline: true },
                { name: '\u200B', value: '\u200B', inline: true }
            )
            .setFooter({ text: 'Click buttons below to perform moderation actions' })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mod_warn')
                    .setLabel('Warn User')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId('mod_timeout')
                    .setLabel('Timeout')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔇'),
                new ButtonBuilder()
                    .setCustomId('mod_kick')
                    .setLabel('Kick')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('👢'),
                new ButtonBuilder()
                    .setCustomId('mod_ban')
                    .setLabel('Ban')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔨')
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mod_mute')
                    .setLabel('Mute')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔕'),
                new ButtonBuilder()
                    .setCustomId('mod_unmute')
                    .setLabel('Unmute')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔊'),
                new ButtonBuilder()
                    .setCustomId('mod_infractions')
                    .setLabel('View Infractions')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('mod_clearwarnings')
                    .setLabel('Clear Warnings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🧹')
            );
        
        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
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

            // Leveling setup button handlers
            if (interaction.customId.startsWith('lvl_')) {
                try {
                    delete require.cache[require.resolve('./commands/levelingsetup.js')];
                    const lvlCommand = require('./commands/levelingsetup.js');
                    await lvlCommand.handleButton(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Leveling button error:', error);
                    console.error('Stack trace:', error.stack);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ 
                                content: '❌ An error occurred while processing leveling setup. Please try again or contact an admin.', 
                                ephemeral: true 
                            });
                        } else if (interaction.deferred) {
                            await interaction.editReply({ 
                                content: '❌ An error occurred while processing leveling setup. Please try again or contact an admin.' 
                            });
                        }
                    } catch (replyError) {
                        console.error('Failed to send leveling error message:', replyError);
                    }
                    return;
                }
            }

            // Leave setup button handlers
            if (interaction.customId.startsWith('leave_')) {
                try {
                    delete require.cache[require.resolve('./commands/leavesetup.js')];
                    const leaveCommand = require('./commands/leavesetup.js');
                    await leaveCommand.handleButton(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Leave button error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }

            // Keyword setup button handlers
            if (interaction.customId.startsWith('keyword_')) {
                try {
                    delete require.cache[require.resolve('./commands/keywordsetup.js')];
                    const keywordCommand = require('./commands/keywordsetup.js');
                    await keywordCommand.handleButton(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Keyword button error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }

            // PCommands button handlers
            if (interaction.customId.startsWith('pcmd_')) {
                try {
                    delete require.cache[require.resolve('./commands/pcommands.js')];
                    const pcommandsCommand = require('./commands/pcommands.js');
                    await pcommandsCommand.handleButton(interaction);
                    return;
                } catch (error) {
                    console.error('❌ PCommands button error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
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
            
            // AI system button handlers (new panel system)
            if (interaction.customId.startsWith('ai_')) {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ content: '❌ You need Administrator permission to use this.', ephemeral: true });
                }
                
                const aisetupCommand = require('./commands/aisetup.js');
                await aisetupCommand.handleButton(interaction);
                return;
            }
            
            // OLD AI system button handlers (legacy - can be removed later)
            if (interaction.customId.startsWith('old_ai_')) {
                if (!requireAdmin(interaction)) return;
                
                const settings = getGuildSettings(guildId);
                if (!settings.ai) {
                    settings.ai = defaultSettings.ai;
                }
                
                try {
                    if (interaction.customId === 'old_ai_toggle') {
                        settings.ai.enabled = !settings.ai.enabled;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ AI chat ${settings.ai.enabled ? '**enabled**' : '**disabled**'}! ${settings.ai.enabled ? `Messages in **#${settings.ai.channelName}** will be answered automatically.` : ''}`, 
                            ephemeral: true 
                        });
                    }
                    else if (interaction.customId === 'old_ai_set_channel') {
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
                    else if (interaction.customId === 'old_ai_set_history') {
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
        
        // Power Options button handlers
        if (interaction.customId.startsWith('power_')) {
            if (interaction.user.id !== config.botOwnerId) {
                return interaction.reply({ content: '❌ Only the bot owner can use this!', ephemeral: true });
            }
            
            if (interaction.customId === 'power_shutdown') {
                await interaction.deferUpdate();
                
                const shutdownEmbed = new EmbedBuilder()
                    .setTitle('🔴 Bot Shutting Down')
                    .setDescription('Initiating graceful shutdown sequence...\n\n✅ Sending offline notifications\n⏳ Saving all data\n👋 Goodbye!')
                    .setColor(0xFF0000)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [shutdownEmbed], components: [] });
                
                setTimeout(() => {
                    gracefulShutdown('Discord power panel shutdown');
                }, 1000);
            }
            
            else if (interaction.customId === 'power_restart') {
                await interaction.deferUpdate();
                
                const restartEmbed = new EmbedBuilder()
                    .setTitle('🔄 Restarting Bot')
                    .setDescription('Performing manual restart...\n\nThe bot will be back online in a few seconds.')
                    .setColor(0x00BFFF)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [restartEmbed], components: [] });
                
                fsSync.writeFileSync('./update-marker.json', JSON.stringify({
                    channelId: interaction.channel.id,
                    guildId: interaction.guild.id,
                    timestamp: Date.now(),
                    isManualRestart: true
                }));
                
                console.log('🔄 Manual restart triggered via power panel');
                setTimeout(() => process.exit(0), 1000);
            }
            
            else if (interaction.customId === 'power_update') {
                await interaction.deferUpdate();
                
                const updateEmbed = new EmbedBuilder()
                    .setTitle('🔄 Updating Bot')
                    .setDescription('Pulling latest code from GitHub...')
                    .setColor(0xFFAA00)
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [updateEmbed], components: [] });
                
                const { exec } = require('child_process');
                const startTime = Date.now();
                
                const backupFiles = ['config.json', '.secure-config', 'serverSettings.json', 'userData.json', 'ticketData.json', 'moderationData.json'];
                backupFiles.forEach(file => {
                    if (fsSync.existsSync(file)) {
                        fsSync.copyFileSync(file, `${file}.backup`);
                    }
                });
                
                exec('git fetch origin && git reset --hard origin/main && npm install --silent --no-audit --no-fund 2>&1', (error, stdout, stderr) => {
                    backupFiles.forEach(file => {
                        if (fsSync.existsSync(`${file}.backup`)) {
                            fsSync.renameSync(`${file}.backup`, file);
                        }
                    });
                    
                    if (error) {
                        console.error(`Update error: ${error}`);
                        return interaction.editReply({ 
                            embeds: [new EmbedBuilder()
                                .setTitle('❌ Update Failed')
                                .setDescription(`\`\`\`${error.message}\`\`\`\n\n**Tip:** Check if there are local file conflicts`)
                                .setColor(0xFF0000)
                                .setTimestamp()]
                        });
                    }
                    
                    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
                    const headMatch = stdout.match(/HEAD is now at ([a-f0-9]+)\s+(.+)/i);
                    const commitHash = headMatch ? headMatch[1] : 'unknown';
                    const commitMsg = headMatch ? headMatch[2] : 'Updated successfully';
                    
                    const npmPackages = (stdout.match(/added \d+ packages?/i) || ['No new packages'])[0];
                    
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Update Complete - Restarting')
                        .setDescription(`**Commit:** \`${commitHash}\`\n**Message:** ${commitMsg}\n**NPM:** ${npmPackages}\n**Time:** ${timeTaken}s\n\n🔄 Bot restarting...`)
                        .setColor(0x00FF00)
                        .setTimestamp();
                    
                    interaction.editReply({ embeds: [successEmbed] }).then(() => {
                        fsSync.writeFileSync('./update-marker.json', JSON.stringify({
                            channelId: interaction.channel.id,
                            guildId: interaction.guild.id,
                            timestamp: Date.now(),
                            gitOutput: stdout.substring(0, 500)
                        }));
                        setTimeout(() => process.exit(0), 2000);
                    });
                });
            }
        }
        
        // Leveling system button handlers
        if (interaction.customId.startsWith('leveling_')) {
            if (!requireAdmin(interaction)) return;
            
            const guildId = interaction.guild.id;
            const settings = getGuildSettings(guildId);
            
            if (interaction.customId === 'leveling_toggle') {
                settings.leveling.enabled = !settings.leveling.enabled;
                saveSettings();
                await interaction.reply({ 
                    content: `✅ Leveling system ${settings.leveling.enabled ? 'enabled' : 'disabled'}!`, 
                    ephemeral: true 
                });
            }
            
            else if (interaction.customId === 'leveling_xprange') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_xprange_modal')
                    .setTitle('Set XP Range');
                
                const minInput = new TextInputBuilder()
                    .setCustomId('min_xp')
                    .setLabel('Minimum XP per message')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 10')
                    .setRequired(true);
                
                const maxInput = new TextInputBuilder()
                    .setCustomId('max_xp')
                    .setLabel('Maximum XP per message')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 25')
                    .setRequired(true);
                
                const row1 = new ActionRowBuilder().addComponents(minInput);
                const row2 = new ActionRowBuilder().addComponents(maxInput);
                
                modal.addComponents(row1, row2);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_cooldown') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_cooldown_modal')
                    .setTitle('Set XP Cooldown');
                
                const cooldownInput = new TextInputBuilder()
                    .setCustomId('cooldown_seconds')
                    .setLabel('Cooldown in seconds')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 60')
                    .setRequired(true);
                
                const row = new ActionRowBuilder().addComponents(cooldownInput);
                modal.addComponents(row);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_maxlevel') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_maxlevel_modal')
                    .setTitle('Set Maximum Level');
                
                const levelInput = new TextInputBuilder()
                    .setCustomId('max_level')
                    .setLabel('Maximum level (1-1000)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 100')
                    .setRequired(true);
                
                const row = new ActionRowBuilder().addComponents(levelInput);
                modal.addComponents(row);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_channel') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_channel_modal')
                    .setTitle('Set Level Up Channel');
                
                const channelInput = new TextInputBuilder()
                    .setCustomId('channel_id')
                    .setLabel('Channel ID or mention (blank for current)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., #level-ups or leave blank')
                    .setRequired(false);
                
                const row = new ActionRowBuilder().addComponents(channelInput);
                modal.addComponents(row);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_addrole') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_addrole_modal')
                    .setTitle('Add Level Role');
                
                const levelInput = new TextInputBuilder()
                    .setCustomId('role_level')
                    .setLabel('Level required')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 10')
                    .setRequired(true);
                
                const roleInput = new TextInputBuilder()
                    .setCustomId('role_id')
                    .setLabel('Role ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., @Role or role ID')
                    .setRequired(true);
                
                const row1 = new ActionRowBuilder().addComponents(levelInput);
                const row2 = new ActionRowBuilder().addComponents(roleInput);
                
                modal.addComponents(row1, row2);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_removerole') {
                const modal = new ModalBuilder()
                    .setCustomId('leveling_removerole_modal')
                    .setTitle('Remove Level Role');
                
                const levelInput = new TextInputBuilder()
                    .setCustomId('role_level')
                    .setLabel('Level to remove role from')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 10')
                    .setRequired(true);
                
                const row = new ActionRowBuilder().addComponents(levelInput);
                modal.addComponents(row);
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'leveling_viewroles') {
                const roles = settings.leveling.levelRoles;
                
                if (Object.keys(roles).length === 0) {
                    await interaction.reply({ 
                        content: '❌ No level roles configured!', 
                        ephemeral: true 
                    });
                    return;
                }
                
                let rolesList = '**Configured Level Roles:**\n\n';
                for (const [level, roleId] of Object.entries(roles)) {
                    rolesList += `Level ${level}: <@&${roleId}>\n`;
                }
                
                await interaction.reply({ content: rolesList, ephemeral: true });
            }
        }
        
        // Ticket system button handlers
        if (interaction.customId.startsWith('ticket_')) {
            if (!requireAdmin(interaction)) return;
            
            const guildId = interaction.guild.id;
            initializeTicketSystem(guildId);
            const settings = ticketData[guildId].settings;
            
            if (interaction.customId === 'ticket_toggle') {
                settings.enabled = !settings.enabled;
                saveTicketData();
                await interaction.reply({ 
                    content: `✅ Ticket system ${settings.enabled ? 'enabled' : 'disabled'}!`, 
                    ephemeral: true 
                });
            }
            
            else if (interaction.customId === 'ticket_staffrole') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_staffrole_modal')
                    .setTitle('Set Staff Role');
                
                const roleInput = new TextInputBuilder()
                    .setCustomId('role_id')
                    .setLabel('Role ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('@Staff or role ID')
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'ticket_category') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_category_modal')
                    .setTitle('Set Category Name');
                
                const categoryInput = new TextInputBuilder()
                    .setCustomId('category_name')
                    .setLabel('Category name for tickets')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Support Tickets')
                    .setValue(settings.categoryName)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(categoryInput));
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'ticket_welcomemsg') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_welcomemsg_modal')
                    .setTitle('Set Welcome Message');
                
                const messageInput = new TextInputBuilder()
                    .setCustomId('message')
                    .setLabel('Message shown in new tickets')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Thank you for creating a ticket!')
                    .setValue(settings.ticketMessage)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'ticket_closemsg') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_closemsg_modal')
                    .setTitle('Set Close Message');
                
                const messageInput = new TextInputBuilder()
                    .setCustomId('message')
                    .setLabel('DM sent when ticket is closed')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Your ticket has been closed.')
                    .setValue(settings.closedMessage)
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'ticket_panel') {
                const modal = new ModalBuilder()
                    .setCustomId('ticket_panel_modal')
                    .setTitle('Create Ticket Panel');
                
                const channelInput = new TextInputBuilder()
                    .setCustomId('channel_id')
                    .setLabel('Channel ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#support or channel ID')
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'ticket_refresh') {
                const staffRole = settings.staffRoleId ? `<@&${settings.staffRoleId}>` : 'Not set';
                
                const embed = new EmbedBuilder()
                    .setTitle('🎫 Ticket System Control Panel')
                    .setColor(settings.enabled ? 0x00FF00 : 0xFF0000)
                    .setDescription(
                        `System is currently **${settings.enabled ? '✅ Enabled' : '❌ Disabled'}**\n\n` +
                        `Manage your server's support ticket system.\n\n` +
                        `Click the buttons below to configure ticket settings.`
                    )
                    .addFields(
                        { name: '📡 Status', value: settings.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: '👮 Staff Role', value: staffRole, inline: true },
                        { name: '📁 Category', value: settings.categoryName, inline: true },
                        { name: '🎫 Total Tickets', value: ticketData[guildId].counter.toString(), inline: true },
                        { name: '📝 Welcome Message', value: settings.ticketMessage.substring(0, 100) + '...', inline: false },
                        { name: '🔒 Close Message', value: settings.closedMessage.substring(0, 100) + '...', inline: false }
                    )
                    .setFooter({ text: 'Click buttons below to configure ticket system' })
                    .setTimestamp();
                
                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_toggle')
                            .setLabel(settings.enabled ? 'Disable System' : 'Enable System')
                            .setStyle(settings.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                            .setEmoji(settings.enabled ? '❌' : '✅'),
                        new ButtonBuilder()
                            .setCustomId('ticket_staffrole')
                            .setLabel('Set Staff Role')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('👮'),
                        new ButtonBuilder()
                            .setCustomId('ticket_category')
                            .setLabel('Set Category')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📁'),
                        new ButtonBuilder()
                            .setCustomId('ticket_panel')
                            .setLabel('Create Panel')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🎫')
                    );
                
                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_welcomemsg')
                            .setLabel('Welcome Message')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📝'),
                        new ButtonBuilder()
                            .setCustomId('ticket_closemsg')
                            .setLabel('Close Message')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔒'),
                        new ButtonBuilder()
                            .setCustomId('ticket_refresh')
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔄')
                    );
                
                await interaction.update({ embeds: [embed], components: [row1, row2] });
            }
        }
        
        // Webhook system button handlers
        if (interaction.customId.startsWith('webhook_')) {
            if (!requireAdmin(interaction)) return;
            
            // Handle webhook send button
            if (interaction.customId.startsWith('webhook_send_')) {
                const modal = new ModalBuilder()
                    .setCustomId('webhook_send_url_modal')
                    .setTitle('Send Embed to Webhook');
                
                const urlInput = new TextInputBuilder()
                    .setCustomId('webhook_url')
                    .setLabel('Webhook URL')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('https://discord.com/api/webhooks/...')
                    .setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
                await interaction.showModal(modal);
                return;
            }
            
            if (interaction.customId === 'webhook_edit') {
                await interaction.deferUpdate();
                
                const modal = new ModalBuilder()
                    .setCustomId('webhook_embed_modal')
                    .setTitle('Design Custom Embed');
                
                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel('Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Your Service Name')
                    .setRequired(true);
                
                const descInput = new TextInputBuilder()
                    .setCustomId('embed_description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Service description and details...')
                    .setRequired(true);
                
                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel('Embed Color (hex)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#5865F2 or 5865F2')
                    .setValue('#5865F2')
                    .setRequired(false);
                
                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel('Image URL (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setRequired(false);
                
                const footerInput = new TextInputBuilder()
                    .setCustomId('embed_footer')
                    .setLabel('Footer Text (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('DSC.GG/TER152')
                    .setRequired(false);
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(imageInput),
                    new ActionRowBuilder().addComponents(footerInput)
                );
                
                await interaction.followUp({ content: 'Opening embed editor...', ephemeral: true });
                return;
            }
            
            if (interaction.customId === 'webhook_cancel') {
                await interaction.update({ 
                    content: '❌ Embed creation cancelled.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            if (interaction.customId === 'webhook_create') {
                const modal = new ModalBuilder()
                    .setCustomId('webhook_create_modal')
                    .setTitle('Create New Webhook');
                
                const channelInput = new TextInputBuilder()
                    .setCustomId('channel_id')
                    .setLabel('Channel ID or mention')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#channel or channel ID')
                    .setRequired(true);
                
                const nameInput = new TextInputBuilder()
                    .setCustomId('webhook_name')
                    .setLabel('Webhook Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Service Bot')
                    .setRequired(true);
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelInput),
                    new ActionRowBuilder().addComponents(nameInput)
                );
                
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'webhook_embed') {
                const modal = new ModalBuilder()
                    .setCustomId('webhook_embed_modal')
                    .setTitle('Design Custom Embed');
                
                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel('Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Your Service Name')
                    .setRequired(true);
                
                const descInput = new TextInputBuilder()
                    .setCustomId('embed_description')
                    .setLabel('Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Service description and details...')
                    .setRequired(true);
                
                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel('Embed Color (hex)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('#5865F2 or 5865F2')
                    .setValue('#5865F2')
                    .setRequired(false);
                
                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel('Image URL (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setRequired(false);
                
                const footerInput = new TextInputBuilder()
                    .setCustomId('embed_footer')
                    .setLabel('Footer Text (optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('DSC.GG/TER152')
                    .setRequired(false);
                
                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(imageInput),
                    new ActionRowBuilder().addComponents(footerInput)
                );
                
                await interaction.showModal(modal);
            }
            
            else if (interaction.customId === 'webhook_list') {
                const webhooks = await interaction.guild.fetchWebhooks();
                
                if (webhooks.size === 0) {
                    await interaction.reply({ 
                        content: '❌ No webhooks found in this server.', 
                        ephemeral: true 
                    });
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('📋 Server Webhooks')
                    .setColor(0x5865F2)
                    .setDescription(`Found ${webhooks.size} webhook(s)`)
                    .setTimestamp();
                
                webhooks.forEach(webhook => {
                    const channel = interaction.guild.channels.cache.get(webhook.channelId);
                    embed.addFields({
                        name: `🔗 ${webhook.name}`,
                        value: `Channel: ${channel ? `<#${channel.id}>` : 'Unknown'}\nID: \`${webhook.id}\``,
                        inline: true
                    });
                });
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
        
        // Moderator menu button handlers
        if (interaction.customId.startsWith('mod_')) {
        if (!requireAdmin(interaction)) return;
        
        const settings = getGuildSettings(guildId);
        if (!settings.moderation) settings.moderation = defaultSettings.moderation;
        
        // Moderation action handlers (from /moderator panel)
        if (interaction.customId === 'mod_warn') {
            const modal = new ModalBuilder()
                .setCustomId('mod_warn_modal')
                .setTitle('⚠️ Warn User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Why are you warning this user?')
                .setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_timeout') {
            const modal = new ModalBuilder()
                .setCustomId('mod_timeout_action_modal')
                .setTitle('🔇 Timeout User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            const durationInput = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel('Duration in minutes (1-40320)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('10')
                .setRequired(true);
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Reason for timeout')
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(durationInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_kick') {
            const modal = new ModalBuilder()
                .setCustomId('mod_kick_modal')
                .setTitle('👢 Kick User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Reason for kick')
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_ban') {
            const modal = new ModalBuilder()
                .setCustomId('mod_ban_modal')
                .setTitle('🔨 Ban User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Reason for ban')
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_mute') {
            const modal = new ModalBuilder()
                .setCustomId('mod_mute_modal')
                .setTitle('🔕 Mute User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Reason for mute')
                .setRequired(false);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_unmute') {
            const modal = new ModalBuilder()
                .setCustomId('mod_unmute_modal')
                .setTitle('🔊 Unmute User');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_infractions') {
            const modal = new ModalBuilder()
                .setCustomId('mod_infractions_modal')
                .setTitle('📋 View Infractions');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        else if (interaction.customId === 'mod_clearwarnings') {
            const modal = new ModalBuilder()
                .setCustomId('mod_clearwarnings_modal')
                .setTitle('🧹 Clear Warnings');
            
            const userInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('User ID or mention')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('@user or user ID')
                .setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(userInput)
            );
            
            await interaction.showModal(modal);
            return;
        }
        
        // Moderation settings handlers (existing)
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
                .setLabel('Channel Name or ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('general or 1234567890')
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
                .setLabel('Channel Name or ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('general or 1234567890')
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [SNAKE GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [TICTACTOE GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [CONNECT4 GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [WORDLE GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [MINESWEEPER GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [2048 GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [MEMORY GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [FASTTYPE GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [FINDEMOJI GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [GUESSPOKEMON GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [RPS GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [HANGMAN GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [TRIVIA GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [SLOTS GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
                
                try {
                    await game.startGame();
                } catch (error) {
                    console.error('❌ [WOULDYOURATHER GAME] Error:', error);
                    await interaction.followUp({ content: '❌ Failed to start game. Please try again.', ephemeral: true }).catch(() => {});
                }
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
    
    // Transcript ticket button (Staff only)
    if (interaction.customId.startsWith('transcript_ticket_')) {
        const channelId = interaction.customId.replace('transcript_ticket_', '');
        const ticketInfo = ticketData[guildId].tickets[channelId];
        
        if (!ticketInfo) {
            return interaction.reply({ content: '❌ Ticket not found!', ephemeral: true });
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
                        `**👤 Creator:** ${creator.tag}\n` +
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
                        .setCustomId(`transcript_ticket_${ticketChannel.id}`)
                        .setLabel('View Transcript')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📋'),
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

            // Leveling setup modal handlers
            if (interaction.customId.includes('lvl_modal_')) {
                try {
                    delete require.cache[require.resolve('./commands/levelingsetup.js')];
                    const lvlCommand = require('./commands/levelingsetup.js');
                    await lvlCommand.handleModal(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Leveling modal error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }

            // Leave setup modal handlers
            if (interaction.customId.includes('leave_modal_')) {
                try {
                    delete require.cache[require.resolve('./commands/leavesetup.js')];
                    const leaveCommand = require('./commands/leavesetup.js');
                    await leaveCommand.handleModal(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Leave modal error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }

            // Keyword setup modal handlers
            if (interaction.customId.includes('keyword_modal_')) {
                try {
                    delete require.cache[require.resolve('./commands/keywordsetup.js')];
                    const keywordCommand = require('./commands/keywordsetup.js');
                    await keywordCommand.handleModal(interaction);
                    return;
                } catch (error) {
                    console.error('❌ Keyword modal error:', error);
                    await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                    return;
                }
            }

            // PCommands modal handlers
            if (interaction.customId.includes('pcmd_modal_')) {
                try {
                    delete require.cache[require.resolve('./commands/pcommands.js')];
                    const pcommandsCommand = require('./commands/pcommands.js');
                    await pcommandsCommand.handleModal(interaction);
                    return;
                } catch (error) {
                    console.error('❌ PCommands modal error:', error);
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
            
            // AI system modal handlers (new panel system)
            if (interaction.customId.startsWith('ai_modal_')) {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions to use this command!', 
                        ephemeral: true 
                    });
                }
                
                const aisetupCommand = require('./commands/aisetup.js');
                await aisetupCommand.handleModal(interaction);
                return;
            }
            
            // OLD AI system modal handlers (legacy)
            if (interaction.customId.startsWith('old_ai_')) {
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
                    
                    if (interaction.customId === 'old_ai_channel_modal') {
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
            
            // Ticket system modal handlers
            if (interaction.customId.startsWith('ticket_')) {
                const guildId = interaction.guild.id;
                
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions!', 
                        ephemeral: true 
                    });
                }
                
                try {
                    // Leveling modal handlers
                    if (interaction.customId === 'leveling_xprange_modal') {
                        const settings = getGuildSettings(guildId);
                        const minXP = parseInt(interaction.fields.getTextInputValue('min_xp'));
                        const maxXP = parseInt(interaction.fields.getTextInputValue('max_xp'));
                        
                        if (isNaN(minXP) || isNaN(maxXP)) {
                            return interaction.reply({ content: '❌ Please enter valid numbers!', ephemeral: true });
                        }
                        
                        if (minXP > maxXP) {
                            return interaction.reply({ content: '❌ Min XP cannot be greater than Max XP!', ephemeral: true });
                        }
                        
                        settings.leveling.minXP = minXP;
                        settings.leveling.maxXP = maxXP;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ XP range set to **${minXP}-${maxXP}** per message!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'leveling_cooldown_modal') {
                        const settings = getGuildSettings(guildId);
                        const seconds = parseInt(interaction.fields.getTextInputValue('cooldown_seconds'));
                        
                        if (isNaN(seconds) || seconds < 0) {
                            return interaction.reply({ content: '❌ Please enter a valid number of seconds!', ephemeral: true });
                        }
                        
                        settings.leveling.cooldown = seconds * 1000;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ XP cooldown set to **${seconds} seconds**!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'leveling_maxlevel_modal') {
                        const settings = getGuildSettings(guildId);
                        const level = parseInt(interaction.fields.getTextInputValue('max_level'));
                        
                        if (isNaN(level) || level < 1 || level > 1000) {
                            return interaction.reply({ content: '❌ Max level must be between 1 and 1000!', ephemeral: true });
                        }
                        
                        settings.leveling.maxLevel = level;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Max level set to **${level}**!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'leveling_channel_modal') {
                        const settings = getGuildSettings(guildId);
                        const channelInput = interaction.fields.getTextInputValue('channel_id').trim();
                        
                        if (!channelInput) {
                            settings.leveling.levelUpChannelId = null;
                            saveSettings();
                            await interaction.reply({ 
                                content: '✅ Level up messages will be sent in the current channel!', 
                                ephemeral: true 
                            });
                            return;
                        }
                        
                        const channelMatch = channelInput.match(/(\d{17,19})/);
                        
                        if (!channelMatch) {
                            return interaction.reply({ content: '❌ Invalid channel ID or mention!', ephemeral: true });
                        }
                        
                        const channelId = channelMatch[1];
                        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                        
                        if (!channel) {
                            return interaction.reply({ content: '❌ Channel not found!', ephemeral: true });
                        }
                        
                        settings.leveling.levelUpChannelId = channelId;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Level up channel set to ${channel}!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'leveling_addrole_modal') {
                        const settings = getGuildSettings(guildId);
                        const level = parseInt(interaction.fields.getTextInputValue('role_level'));
                        const roleInput = interaction.fields.getTextInputValue('role_id').trim();
                        
                        if (isNaN(level) || level < 1) {
                            return interaction.reply({ content: '❌ Please enter a valid level!', ephemeral: true });
                        }
                        
                        const roleMatch = roleInput.match(/(\d{17,19})/);
                        
                        if (!roleMatch) {
                            return interaction.reply({ content: '❌ Invalid role ID or mention!', ephemeral: true });
                        }
                        
                        const roleId = roleMatch[1];
                        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                        
                        if (!role) {
                            return interaction.reply({ content: '❌ Role not found!', ephemeral: true });
                        }
                        
                        settings.leveling.levelRoles[level] = roleId;
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Level ${level} role set to ${role}!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'leveling_removerole_modal') {
                        const settings = getGuildSettings(guildId);
                        const level = parseInt(interaction.fields.getTextInputValue('role_level'));
                        
                        if (isNaN(level)) {
                            return interaction.reply({ content: '❌ Please enter a valid level!', ephemeral: true });
                        }
                        
                        if (!settings.leveling.levelRoles[level]) {
                            return interaction.reply({ content: '❌ No role configured for that level!', ephemeral: true });
                        }
                        
                        delete settings.leveling.levelRoles[level];
                        saveSettings();
                        
                        await interaction.reply({ 
                            content: `✅ Removed role for level ${level}!`, 
                            ephemeral: true 
                        });
                    }
                    
                    initializeTicketSystem(guildId);
                    const settings = ticketData[guildId].settings;
                    
                    if (interaction.customId === 'ticket_staffrole_modal') {
                        const roleInput = interaction.fields.getTextInputValue('role_id').trim();
                        const roleMatch = roleInput.match(/(\d{17,19})/);
                        
                        if (!roleMatch) {
                            return interaction.reply({ content: '❌ Invalid role ID or mention!', ephemeral: true });
                        }
                        
                        const roleId = roleMatch[1];
                        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                        
                        if (!role) {
                            return interaction.reply({ content: '❌ Role not found!', ephemeral: true });
                        }
                        
                        settings.staffRoleId = roleId;
                        saveTicketData();
                        
                        await interaction.reply({ 
                            content: `✅ Staff role set to ${role}!`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'ticket_category_modal') {
                        const categoryName = interaction.fields.getTextInputValue('category_name').trim();
                        settings.categoryName = categoryName;
                        saveTicketData();
                        
                        await interaction.reply({ 
                            content: `✅ Category name set to: **${categoryName}**`, 
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'ticket_welcomemsg_modal') {
                        const message = interaction.fields.getTextInputValue('message').trim();
                        settings.ticketMessage = message;
                        saveTicketData();
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Welcome Message Updated')
                            .setDescription('**Preview:**\n\n' + message)
                            .setColor(0x00FF00)
                            .setFooter({ text: 'This message will appear in new tickets' })
                            .setTimestamp();
                        
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    
                    else if (interaction.customId === 'ticket_closemsg_modal') {
                        const message = interaction.fields.getTextInputValue('message').trim();
                        settings.closedMessage = message;
                        saveTicketData();
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Close Message Updated')
                            .setDescription('**Preview:**\n\n' + message)
                            .setColor(0x00FF00)
                            .setFooter({ text: 'This message will be sent in DMs when tickets close' })
                            .setTimestamp();
                        
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    
                    else if (interaction.customId === 'ticket_panel_modal') {
                        const channelInput = interaction.fields.getTextInputValue('channel_id').trim();
                        const channelMatch = channelInput.match(/(\d{17,19})/);
                        
                        if (!channelMatch) {
                            return interaction.reply({ content: '❌ Invalid channel ID or mention!', ephemeral: true });
                        }
                        
                        const channelId = channelMatch[1];
                        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                        
                        if (!channel || channel.type !== ChannelType.GuildText) {
                            return interaction.reply({ content: '❌ Channel not found or not a text channel!', ephemeral: true });
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
                            await channel.send({ embeds: [panelEmbed], components: [panelButton] });
                            await interaction.reply({ 
                                content: `✅ Ticket panel created in ${channel}!`, 
                                ephemeral: true 
                            });
                        } catch (error) {
                            console.error('Error creating ticket panel:', error);
                            await interaction.reply({ 
                                content: '❌ Failed to create panel. Check bot permissions!', 
                                ephemeral: true 
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error('❌ Ticket modal error:', error);
                    await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
                }
                return;
            }
            
            // Webhook system modal handlers
            if (interaction.customId.startsWith('webhook_')) {
                if (!interaction.member.permissions.has('Administrator')) {
                    return interaction.reply({ 
                        content: '❌ You need Administrator permissions to use this command!', 
                        ephemeral: true 
                    });
                }
                
                try {
                    if (interaction.customId === 'webhook_create_modal') {
                        const channelInput = interaction.fields.getTextInputValue('channel_id').trim();
                        const webhookName = interaction.fields.getTextInputValue('webhook_name').trim();
                        
                        const channelMatch = channelInput.match(/(\d{17,19})/);
                        if (!channelMatch) {
                            return interaction.reply({ content: '❌ Invalid channel ID or mention!', ephemeral: true });
                        }
                        
                        const channelId = channelMatch[1];
                        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                        
                        if (!channel || channel.type !== ChannelType.GuildText) {
                            return interaction.reply({ content: '❌ Channel not found or not a text channel!', ephemeral: true });
                        }
                        
                        const webhook = await channel.createWebhook({
                            name: webhookName,
                            avatar: interaction.guild.iconURL()
                        });
                        
                        const embed = new EmbedBuilder()
                            .setTitle('✅ Webhook Created')
                            .setDescription(`Webhook **${webhookName}** created successfully!`)
                            .addFields(
                                { name: 'Channel', value: `<#${channel.id}>`, inline: true },
                                { name: 'Webhook ID', value: `\`${webhook.id}\``, inline: true },
                                { name: 'Webhook URL', value: `||${webhook.url}||`, inline: false }
                            )
                            .setColor(0x00FF00)
                            .setFooter({ text: 'Keep the webhook URL private!' })
                            .setTimestamp();
                        
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    
                    else if (interaction.customId === 'webhook_embed_modal') {
                        const title = interaction.fields.getTextInputValue('embed_title').trim();
                        const description = interaction.fields.getTextInputValue('embed_description').trim();
                        const colorInput = interaction.fields.getTextInputValue('embed_color')?.trim() || '#5865F2';
                        const imageUrl = interaction.fields.getTextInputValue('embed_image')?.trim() || null;
                        const footerText = interaction.fields.getTextInputValue('embed_footer')?.trim() || null;
                        
                        // Parse color
                        let color = 0x5865F2;
                        const hexMatch = colorInput.match(/^#?([0-9A-Fa-f]{6})$/);
                        if (hexMatch) {
                            color = parseInt(hexMatch[1], 16);
                        }
                        
                        const previewEmbed = new EmbedBuilder()
                            .setTitle(title)
                            .setDescription(description)
                            .setColor(color)
                            .setTimestamp();
                        
                        if (imageUrl) {
                            try {
                                previewEmbed.setImage(imageUrl);
                            } catch (error) {
                                console.error('Invalid image URL:', error);
                            }
                        }
                        
                        if (footerText) {
                            previewEmbed.setFooter({ text: footerText });
                        }
                        
                        const buttons = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`webhook_send_${Date.now()}`)
                                    .setLabel('Send to Webhook')
                                    .setStyle(ButtonStyle.Success)
                                    .setEmoji('📤'),
                                new ButtonBuilder()
                                    .setCustomId('webhook_edit')
                                    .setLabel('Edit Again')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('✏️'),
                                new ButtonBuilder()
                                    .setCustomId('webhook_cancel')
                                    .setLabel('Cancel')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('❌')
                            );
                        
                        await interaction.reply({ 
                            content: '**📋 Embed Preview:**\nClick "Send to Webhook" and provide webhook URL to send this embed.',
                            embeds: [previewEmbed], 
                            components: [buttons],
                            ephemeral: true 
                        });
                        
                        // Store embed data temporarily for sending
                        if (!interaction.client.webhookEmbeds) interaction.client.webhookEmbeds = new Map();
                        interaction.client.webhookEmbeds.set(interaction.user.id, previewEmbed.toJSON());
                    }
                    
                    else if (interaction.customId === 'webhook_send_url_modal') {
                        const webhookUrl = interaction.fields.getTextInputValue('webhook_url').trim();
                        
                        // Validate webhook URL
                        if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
                            !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
                            return interaction.reply({ 
                                content: '❌ Invalid webhook URL! Must start with `https://discord.com/api/webhooks/`', 
                                ephemeral: true 
                            });
                        }
                        
                        // Get stored embed
                        const embedData = interaction.client.webhookEmbeds?.get(interaction.user.id);
                        if (!embedData) {
                            return interaction.reply({ 
                                content: '❌ Embed data not found! Please create the embed again.', 
                                ephemeral: true 
                            });
                        }
                        
                        try {
                            const { WebhookClient } = require('discord.js');
                            const webhook = new WebhookClient({ url: webhookUrl });
                            
                            await webhook.send({ embeds: [embedData] });
                            
                            await interaction.reply({ 
                                content: '✅ Embed sent successfully via webhook!', 
                                ephemeral: true 
                            });
                            
                            // Clean up stored embed
                            interaction.client.webhookEmbeds.delete(interaction.user.id);
                            
                        } catch (error) {
                            console.error('Webhook send error:', error);
                            await interaction.reply({ 
                                content: '❌ Failed to send webhook! Make sure the URL is valid and the webhook exists.', 
                                ephemeral: true 
                            });
                        }
                    }
                    
                } catch (error) {
                    console.error('❌ Webhook modal error:', error);
                    await interaction.reply({ 
                        content: '❌ An error occurred! ' + error.message, 
                        ephemeral: true 
                    }).catch(() => {});
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(channelId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid channel ID format!', 
                                ephemeral: true 
                            });
                        }
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(roleId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID format!', 
                                ephemeral: true 
                            });
                        }
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(roleId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID format!', 
                                ephemeral: true 
                            });
                        }
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(roleId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid role ID format!', 
                                ephemeral: true 
                            });
                        }
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
                    
                    // Moderation action modals (from /moderator panel)
                    else if (interaction.customId === 'mod_warn_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        const reason = interaction.fields.getTextInputValue('reason').trim();
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        if (!user) {
                            return interaction.reply({ content: '❌ User not found!', ephemeral: true });
                        }
                        
                        initializeModerationData(guildId);
                        if (!moderationData[guildId].warnings[userId]) {
                            moderationData[guildId].warnings[userId] = [];
                        }
                        
                        const warning = { reason, timestamp: Date.now(), moderator: interaction.user.id };
                        moderationData[guildId].warnings[userId].push(warning);
                        saveModerationData();
                        
                        addInfraction(guildId, userId, 'warn', interaction.user.id, reason);
                        
                        if (settings.moderation.dmOnAction) {
                            try {
                                await user.send({
                                    embeds: [new EmbedBuilder()
                                        .setTitle('⚠️ You Have Been Warned')
                                        .setDescription(`You have been warned in **${interaction.guild.name}**`)
                                        .addFields({ name: 'Reason', value: reason })
                                        .setColor(0xFFAA00)
                                        .setTimestamp()]
                                });
                            } catch (error) {}
                        }
                        
                        await logModerationAction(interaction.guild, '⚠️ Warning Issued', interaction.user, user, reason);
                        
                        const warningCount = moderationData[guildId].warnings[userId].length;
                        await interaction.reply({ 
                            embeds: [new EmbedBuilder()
                                .setTitle('✅ User Warned')
                                .setDescription(`${user} has been warned (${warningCount}/${settings.moderation.warningThreshold})`)
                                .addFields({ name: 'Reason', value: reason })
                                .setColor(0xFFAA00)],
                            ephemeral: true 
                        });
                    }
                    
                    else if (interaction.customId === 'mod_timeout_action_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        const durationStr = interaction.fields.getTextInputValue('duration').trim();
                        const reason = interaction.fields.getTextInputValue('reason')?.trim() || 'No reason provided';
                        
                        const duration = parseInt(durationStr);
                        if (isNaN(duration) || duration < 1 || duration > 40320) {
                            return interaction.reply({ content: '❌ Invalid duration! Must be between 1-40320 minutes.', ephemeral: true });
                        }
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        
                        if (!member) {
                            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
                        }
                        
                        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                            return interaction.reply({ content: '❌ You cannot timeout administrators!', ephemeral: true });
                        }
                        
                        try {
                            await member.timeout(duration * 60 * 1000, reason);
                            addInfraction(guildId, userId, 'timeout', interaction.user.id, reason);
                            
                            if (settings.moderation.dmOnAction) {
                                try {
                                    await user.send({
                                        embeds: [new EmbedBuilder()
                                            .setTitle('🔇 You Have Been Timed Out')
                                            .setDescription(`You have been timed out in **${interaction.guild.name}** for ${duration} minutes`)
                                            .addFields({ name: 'Reason', value: reason })
                                            .setColor(0xFF6600)
                                            .setTimestamp()]
                                    });
                                } catch (error) {}
                            }
                            
                            await logModerationAction(interaction.guild, `🔇 Timeout (${duration}m)`, interaction.user, user, reason);
                            await interaction.reply({ 
                                embeds: [new EmbedBuilder()
                                    .setTitle('✅ User Timed Out')
                                    .setDescription(`${user} has been timed out for ${duration} minutes`)
                                    .addFields({ name: 'Reason', value: reason })
                                    .setColor(0xFF6600)],
                                ephemeral: true 
                            });
                        } catch (error) {
                            await interaction.reply({ content: `❌ Failed to timeout user: ${error.message}`, ephemeral: true });
                        }
                    }
                    
                    else if (interaction.customId === 'mod_kick_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        const reason = interaction.fields.getTextInputValue('reason')?.trim() || 'No reason provided';
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        
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
                            addInfraction(guildId, userId, 'kick', interaction.user.id, reason);
                            
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
                                } catch (error) {}
                            }
                            
                            await member.kick(reason);
                            await logModerationAction(interaction.guild, '👢 Kick', interaction.user, user, reason);
                            await interaction.reply({ 
                                embeds: [new EmbedBuilder()
                                    .setTitle('✅ User Kicked')
                                    .setDescription(`${user.tag} has been kicked`)
                                    .addFields({ name: 'Reason', value: reason })
                                    .setColor(0xFF6600)],
                                ephemeral: true 
                            });
                        } catch (error) {
                            await interaction.reply({ content: `❌ Failed to kick user: ${error.message}`, ephemeral: true });
                        }
                    }
                    
                    else if (interaction.customId === 'mod_ban_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        const reason = interaction.fields.getTextInputValue('reason')?.trim() || 'No reason provided';
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        
                        if (member?.permissions.has(PermissionFlagsBits.Administrator)) {
                            return interaction.reply({ content: '❌ You cannot ban administrators!', ephemeral: true });
                        }
                        
                        try {
                            addInfraction(guildId, userId, 'ban', interaction.user.id, reason);
                            
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
                                } catch (error) {}
                            }
                            
                            await interaction.guild.members.ban(userId, { reason, deleteMessageSeconds: 604800 });
                            await logModerationAction(interaction.guild, '🔨 Ban', interaction.user, user, reason);
                            await interaction.reply({ 
                                embeds: [new EmbedBuilder()
                                    .setTitle('✅ User Banned')
                                    .setDescription(`${user ? user.tag : userId} has been banned`)
                                    .addFields({ name: 'Reason', value: reason })
                                    .setColor(0xFF0000)],
                                ephemeral: true 
                            });
                        } catch (error) {
                            await interaction.reply({ content: `❌ Failed to ban user: ${error.message}`, ephemeral: true });
                        }
                    }
                    
                    else if (interaction.customId === 'mod_mute_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        const reason = interaction.fields.getTextInputValue('reason')?.trim() || 'No reason provided';
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        
                        if (!member) {
                            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
                        }
                        
                        if (!settings.moderation.muteRole) {
                            return interaction.reply({ content: '❌ Mute role not set! Use moderation settings to configure.', ephemeral: true });
                        }
                        
                        try {
                            await member.roles.add(settings.moderation.muteRole, reason);
                            addInfraction(guildId, userId, 'mute', interaction.user.id, reason);
                            
                            if (settings.moderation.dmOnAction) {
                                try {
                                    await user.send({
                                        embeds: [new EmbedBuilder()
                                            .setTitle('🔕 You Have Been Muted')
                                            .setDescription(`You have been muted in **${interaction.guild.name}**`)
                                            .addFields({ name: 'Reason', value: reason })
                                            .setColor(0x808080)
                                            .setTimestamp()]
                                    });
                                } catch (error) {}
                            }
                            
                            await logModerationAction(interaction.guild, '🔕 Mute', interaction.user, user, reason);
                            await interaction.reply({ 
                                embeds: [new EmbedBuilder()
                                    .setTitle('✅ User Muted')
                                    .setDescription(`${user} has been muted`)
                                    .addFields({ name: 'Reason', value: reason })
                                    .setColor(0x808080)],
                                ephemeral: true 
                            });
                        } catch (error) {
                            await interaction.reply({ content: `❌ Failed to mute user: ${error.message}`, ephemeral: true });
                        }
                    }
                    
                    else if (interaction.customId === 'mod_unmute_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        const member = await interaction.guild.members.fetch(userId).catch(() => null);
                        
                        if (!member) {
                            return interaction.reply({ content: '❌ User not found in this server!', ephemeral: true });
                        }
                        
                        if (!settings.moderation.muteRole) {
                            return interaction.reply({ content: '❌ Mute role not set!', ephemeral: true });
                        }
                        
                        try {
                            await member.roles.remove(settings.moderation.muteRole);
                            await logModerationAction(interaction.guild, '🔊 Unmute', interaction.user, user, 'Unmuted');
                            await interaction.reply({ 
                                embeds: [new EmbedBuilder()
                                    .setTitle('✅ User Unmuted')
                                    .setDescription(`${user} has been unmuted`)
                                    .setColor(0x00FF00)],
                                ephemeral: true 
                            });
                        } catch (error) {
                            await interaction.reply({ content: `❌ Failed to unmute user: ${error.message}`, ephemeral: true });
                        }
                    }
                    
                    else if (interaction.customId === 'mod_infractions_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        
                        initializeModerationData(guildId);
                        const infractions = moderationData[guildId].infractions[userId] || [];
                        
                        if (infractions.length === 0) {
                            return interaction.reply({ content: `${user ? user.tag : userId} has no infractions.`, ephemeral: true });
                        }
                        
                        const embed = new EmbedBuilder()
                            .setTitle(`📋 Infractions for ${user ? user.tag : userId}`)
                            .setColor(0xFF0000)
                            .setThumbnail(user?.displayAvatarURL())
                            .setDescription(`Total infractions: **${infractions.length}**`);
                        
                        infractions.slice(-10).reverse().forEach((infraction, index) => {
                            const date = new Date(infraction.timestamp);
                            const typeEmoji = {
                                warn: '⚠️',
                                timeout: '🔇',
                                kick: '👢',
                                ban: '🔨',
                                mute: '🔕'
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
                        
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                    
                    else if (interaction.customId === 'mod_clearwarnings_modal') {
                        const userInput = interaction.fields.getTextInputValue('user_id').trim();
                        
                        const userMatch = userInput.match(/(\d{17,19})/);
                        if (!userMatch) {
                            return interaction.reply({ content: '❌ Invalid user ID or mention!', ephemeral: true });
                        }
                        
                        const userId = userMatch[1];
                        const user = await client.users.fetch(userId).catch(() => null);
                        
                        initializeModerationData(guildId);
                        const warningCount = (moderationData[guildId].warnings[userId] || []).length;
                        moderationData[guildId].warnings[userId] = [];
                        saveModerationData();
                        
                        await logModerationAction(interaction.guild, '🧹 Warnings Cleared', interaction.user, user, `Cleared ${warningCount} warnings`);
                        await interaction.reply({ 
                            embeds: [new EmbedBuilder()
                                .setTitle('✅ Warnings Cleared')
                                .setDescription(`Cleared **${warningCount}** warnings for ${user ? user.tag : userId}`)
                                .setColor(0x00FF00)],
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(channelId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid channel ID format!', 
                                ephemeral: true 
                            });
                        }
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
                        
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(userId)) {
                            return interaction.reply({ 
                                content: '❌ Invalid user ID format!', 
                                ephemeral: true 
                            });
                        }
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
            
            // Welcome system modal handlers (inline command)
            if (interaction.customId === 'welcome_channel_modal') {
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
                    let channelInput = interaction.fields.getTextInputValue('channel_name').trim();
                    
                    // Check if it's a channel ID (numeric)
                    let channelName = channelInput;
                    if (/^\d+$/.test(channelInput)) {
                        // Validate snowflake ID format
                        if (!/^\d{17,19}$/.test(channelInput)) {
                            return interaction.reply({ 
                                content: '❌ Invalid channel ID format!', 
                                ephemeral: true 
                            });
                        }
                        
                        // It's an ID, fetch the channel
                        const channel = await interaction.guild.channels.fetch(channelInput).catch(() => null);
                        if (!channel) {
                            return interaction.reply({ 
                                content: `❌ Channel with ID \`${channelInput}\` not found!`, 
                                ephemeral: true 
                            });
                        }
                        channelName = channel.name;
                    } else {
                        // It's a name, verify it exists
                        const channel = interaction.guild.channels.cache.find(c => c.name === channelInput);
                        if (!channel) {
                            return interaction.reply({ 
                                content: `❌ Channel \`#${channelInput}\` not found!`, 
                                ephemeral: true 
                            });
                        }
                    }
                    
                    settings.welcome.channelName = channelName;
                    saveSettings();
                    
                    await interaction.reply({ 
                        content: `✅ Welcome channel set to **#${channelName}**!`, 
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error('❌ [WELCOME MODAL] Error:', error);
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
            
            if (interaction.customId === 'welcome_message_modal') {
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
                    const messageText = interaction.fields.getTextInputValue('message_text').trim();
                    
                    settings.welcome.customMessage = messageText;
                    saveSettings();
                    
                    await interaction.reply({ 
                        content: `✅ Welcome message updated!\n\n**Preview:**\n${messageText.substring(0, 200)}`, 
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error('❌ [WELCOME MESSAGE MODAL] Error:', error);
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

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
        // Leveling setup select menu handlers
        if (interaction.customId.startsWith('lvl_select_')) {
            try {
                delete require.cache[require.resolve('./commands/levelingsetup.js')];
                const lvlCommand = require('./commands/levelingsetup.js');
                await lvlCommand.handleSelectMenu(interaction);
                return;
            } catch (error) {
                console.error('❌ Leveling select menu error:', error);
                await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                return;
            }
        }

        // Leave setup select menu handlers
        if (interaction.customId.startsWith('leave_select_')) {
            try {
                delete require.cache[require.resolve('./commands/leavesetup.js')];
                const leaveCommand = require('./commands/leavesetup.js');
                await leaveCommand.handleSelectMenu(interaction);
                return;
            } catch (error) {
                console.error('❌ Leave select menu error:', error);
                await interaction.reply({ content: '❌ An error occurred. Please try again!', ephemeral: true }).catch(() => {});
                return;
            }
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
        
        // GoldHEN version - using manual version (scraping disabled for accuracy)
        console.log(`ℹ️ Using manual GoldHEN version: ${psData.goldhen}`);
        
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
            // Reload settings into memory to ensure AI uses the new data immediately
            serverSettings = JSON.parse(fsSync.readFileSync('./serverSettings.json', 'utf8'));
            const now = new Date();
            console.log(`✅ AI knowledge LIVE-UPDATED from web (${now.toLocaleString()})`);
            console.log(`📊 REAL-TIME DB: PS3 ${psData.ps3OFW}/${psData.ps3CFW} | PS4 ${psData.ps4OFW}/${psData.ps4PPPwn}/${psData.ps4BDJB} | PS5 ${psData.ps5OFW}/${psData.ps5Lapse}/${psData.ps5kstuff}`);
            console.log(`🎮 Homebrew: GoldHEN ${psData.goldhen} | etaHEN ${psData.etahen} | PS3HEN ${psData.ps3hen} | Vita ${psData.vita} | PSP ${psData.psp}`);
        }
    } catch (error) {
        console.error('❌ Failed to update AI knowledge:', error.message);
    }
}

// Run AI knowledge update on startup (reduced to 5 seconds for faster updates)
setTimeout(() => updateAIKnowledge(), 5000); // 5 seconds after bot starts

// Schedule monthly updates (1st of each month at 3 AM)
setInterval(() => {
    const now = new Date();
    // Check if it's the 1st day of the month at 3 AM
    if (now.getDate() === 1 && now.getHours() === 3 && now.getMinutes() < 10) {
        updateAIKnowledge();
        // Also update PS4 error codes monthly
        const ps4Scraper = require('./bot.js');
        if (typeof startPS4ErrorScraper !== 'undefined') {
            console.log('🔄 Running monthly PS4 error code update...');
            // Call the update function directly
            const ps4ErrorPath = './features/ps4ErrorCodes.json';
            (async () => {
                try {
                    const fetch = require('node-fetch');
                    const cheerio = require('cheerio');
                    let currentErrors = loadJSON(ps4ErrorPath, {});
                    let newErrorsFound = 0;
                    
                    const response = await fetch('https://www.playstation.com/en-us/support/error-codes/ps4/');
                    const html = await response.text();
                    const $ = cheerio.load(html);
                    
                    $('body').find('*').each((i, elem) => {
                        const text = $(elem).text();
                        const errorMatches = text.match(/(CE|NP|SU|WS|WV)-\d{5}-\d/g);
                        
                        if (errorMatches) {
                            errorMatches.forEach(code => {
                                if (!currentErrors[code] && !code.startsWith('_')) {
                                    const description = $(elem).next().text().trim() || 'PlayStation error detected. Check PlayStation support for details.';
                                    currentErrors[code] = description.substring(0, 200);
                                    newErrorsFound++;
                                }
                            });
                        }
                    });
                    
                    if (newErrorsFound > 0) {
                        currentErrors._metadata = {
                            description: 'PS4 Error Code Database',
                            lastUpdated: new Date().toISOString(),
                            totalCodes: Object.keys(currentErrors).filter(k => !k.startsWith('_')).length,
                            lastScrape: new Date().toISOString()
                        };
                        fsSync.writeFileSync(ps4ErrorPath, JSON.stringify(currentErrors, null, 2));
                        console.log(`✅ Monthly update: Found ${newErrorsFound} new PS4 error codes!`);
                    }
                } catch (error) {
                    console.error('❌ Monthly PS4 error update failed:', error.message);
                }
            })();
        }
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
        let retryDelay = 1000; // Start with 1 second
        try {
            let ps4Response;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    ps4Response = await fetch(urls.ps4, { timeout: 10000 });
                    if (ps4Response.ok) break;
                } catch (err) {
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retryDelay *= 2; // Exponential backoff
                    } else throw err;
                }
            }
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
        retryDelay = 1000; // Reset delay
        try {
            let ps5Response;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    ps5Response = await fetch(urls.ps5, { timeout: 10000 });
                    if (ps5Response.ok) break;
                } catch (err) {
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retryDelay *= 2;
                    } else throw err;
                }
            }
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
        retryDelay = 1000; // Reset delay
        try {
            let ps3Response;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    ps3Response = await fetch(urls.ps3, { timeout: 10000 });
                    if (ps3Response.ok) break;
                } catch (err) {
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retryDelay *= 2;
                    } else throw err;
                }
            }
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
        retryDelay = 1000; // Reset delay
        try {
            let vitaResponse;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    vitaResponse = await fetch(urls.vita, { timeout: 10000 });
                    if (vitaResponse.ok) break;
                } catch (err) {
                    if (attempt < 2) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        retryDelay *= 2;
                    } else throw err;
                }
            }
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
    for (const channelId of Object.keys(aiConversations)) {
        const messages = aiConversations[channelId];
        if (messages && messages.length > 0) {
            // Remove old messages from the conversation
            const filteredMessages = messages.filter(msg => {
                // Keep messages without timestamp or recent messages
                return !msg.timestamp || msg.timestamp > oneHourAgo;
            });
            
            // Update or delete based on filtered results
            if (filteredMessages.length > 0) {
                aiConversations[channelId] = filteredMessages;
            } else {
                delete aiConversations[channelId];
            }
        } else {
            // Delete empty or invalid conversations
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

// CFW Knowledge Scraper - Updates AI knowledge with latest CFW versions
// CFW Knowledge Scraper - Updates AI knowledge with latest CFW versions
function startCFWKnowledgeScraper() {
    const cfwKnowledgePath = './cfwKnowledge.json';
    
    async function updateCFWKnowledge() {
        try {
            const fetch = require('node-fetch');
            const cheerio = require('cheerio');
            
            // Scrape PSX-Place for latest Evilnat version
            const response = await fetch('https://www.psx-place.com/resources/evilnat-cfw.1146/');
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Try to find version in title or content
            let latestVersion = '4.92'; // Fallback
            const title = $('h1.p-title-value').text();
            const versionMatch = title.match(/(\d+\.\d+)/);
            if (versionMatch) {
                latestVersion = versionMatch[1];
            }
            
            // Load current knowledge
            let knowledge = loadJSON(cfwKnowledgePath, {
                lastUpdated: new Date().toISOString(),
                evilnatCFW: { latestVersion: '4.92', source: 'Manual entry' }
            });
            
            // Update if version changed
            if (knowledge.evilnatCFW.latestVersion !== latestVersion) {
                console.log(`✅ New Evilnat CFW version found: ${latestVersion} (was ${knowledge.evilnatCFW.latestVersion})`);
                knowledge.evilnatCFW.latestVersion = latestVersion;
                knowledge.lastUpdated = new Date().toISOString();
                knowledge.evilnatCFW.source = 'PSX-Place scrape';
                fsSync.writeFileSync(cfwKnowledgePath, JSON.stringify(knowledge, null, 2));
                console.log('💾 CFW knowledge updated!');
            } else {
                console.log(`✓ CFW knowledge up to date (Evilnat ${latestVersion})`);
            }
        } catch (error) {
            console.error('❌ Failed to update CFW knowledge:', error.message);
        }
    }
    
    // Update on startup
    updateCFWKnowledge();
    
    // Check every 24 hours
    setInterval(updateCFWKnowledge, 24 * 60 * 60 * 1000);
    console.log('✅ CFW knowledge scraper started (checks every 24 hours)');
}

// PS4 Error Code Scraper - Updates error database from online sources (runs on startup only, monthly via updateAIKnowledge)
function startPS4ErrorScraper() {
    const ps4ErrorPath = './features/ps4ErrorCodes.json';
    
    async function updatePS4Errors() {
        try {
            const fetch = require('node-fetch');
            const cheerio = require('cheerio');
            
            let currentErrors = loadJSON(ps4ErrorPath, {});
            let newErrorsFound = 0;
            
            // Scrape PlayStation support page
            try {
                const response = await fetch('https://www.playstation.com/en-us/support/error-codes/ps4/');
                const html = await response.text();
                const $ = cheerio.load(html);
                
                // Look for error code patterns (CE-, NP-, SU-, WS-, WV-)
                $('body').find('*').each((i, elem) => {
                    const text = $(elem).text();
                    const errorMatches = text.match(/(CE|NP|SU|WS|WV)-\d{5}-\d/g);
                    
                    if (errorMatches) {
                        errorMatches.forEach(code => {
                            if (!currentErrors[code] && !code.startsWith('_')) {
                                // Try to find description nearby
                                const description = $(elem).next().text().trim() || 'PlayStation error detected. Check PlayStation support for details.';
                                currentErrors[code] = description.substring(0, 200);
                                newErrorsFound++;
                            }
                        });
                    }
                });
            } catch (scrapeError) {
                console.log('⚠️ Could not scrape PlayStation support page:', scrapeError.message);
            }
            
            if (newErrorsFound > 0) {
                currentErrors._metadata = {
                    description: 'PS4 Error Code Database',
                    lastUpdated: new Date().toISOString(),
                    totalCodes: Object.keys(currentErrors).filter(k => !k.startsWith('_')).length,
                    lastScrape: new Date().toISOString()
                };
                fsSync.writeFileSync(ps4ErrorPath, JSON.stringify(currentErrors, null, 2));
                console.log(`✅ Found ${newErrorsFound} new PS4 error codes! Database updated.`);
            } else {
                console.log('✓ PS4 error database up to date');
            }
        } catch (error) {
            console.error('❌ Failed to update PS4 errors:', error.message);
        }
    }
    
    // Update on startup (after 10 seconds) - Monthly updates handled by updateAIKnowledge interval
    setTimeout(updatePS4Errors, 10000);
    console.log('✅ PS4 error scraper started (monthly updates on 1st at 3 AM)');
}

// Automated channel messages - Daily 7 PM reminder only
function startAutomatedMessages() {
    const CHANNEL_ID = '920750934085222470';
    
    // Daily reminder at 7 PM
    function scheduleDailyReminder() {
        const now = new Date();
        const next7PM = new Date();
        next7PM.setHours(19, 0, 0, 0); // 7 PM
        
        // If it's already past 7 PM today, schedule for tomorrow
        if (now >= next7PM) {
            next7PM.setDate(next7PM.getDate() + 1);
        }
        
        const msUntil7PM = next7PM - now;
        
        setTimeout(() => {
            try {
                const channel = client.channels.cache.get(CHANNEL_ID);
                if (channel) {
                    // Format: ## for bigger text, ** for bold
                    const reminders = [
                        "## **Don't forget to check out `/pcommands` to see all server commands!** 🎮",
                        "## **Reminder: Use `/pcommands` to explore all the cool features I have!** ⚡",
                        "## **Hey! Did you know you can type `/pcommands` to see everything I can do?** 🔧",
                        "## **Pro tip: Check `/pcommands` for a full list of server features!** 💡",
                        "## **Don't miss out! Use `/pcommands` to discover all available commands!** 🚀"
                    ];
                    
                    const randomReminder = reminders[Math.floor(Math.random() * reminders.length)];
                    channel.send(randomReminder);
                    console.log('⏰ Sent daily 7 PM reminder');
                }
            } catch (error) {
                console.error('❌ Failed to send daily reminder:', error);
            }
            
            // Schedule next day's reminder (24 hours)
            scheduleDailyReminder();
        }, msUntil7PM);
        
        console.log(`⏰ Daily reminder scheduled for ${next7PM.toLocaleString()}`);
    }
    
    // Start daily reminder only
    scheduleDailyReminder();
    console.log('✅ Daily 7 PM reminder started for channel ' + CHANNEL_ID);
}

// ===== SELLIX WEBHOOK SYSTEM =====
sellixApp.use(express.json());

sellixApp.post('/sellix-webhook', async (req, res) => {
    try {
        const event = req.body;
        
        console.log('📦 Sellix webhook received:', event.event);
        
        // Verify webhook secret if configured
        if (config.sellixWebhookSecret && config.sellixWebhookSecret !== 'YOUR_WEBHOOK_SECRET') {
            const receivedSecret = req.headers['x-sellix-signature'];
            if (receivedSecret !== config.sellixWebhookSecret) {
                console.log('❌ Invalid Sellix webhook signature');
                return res.status(401).send('Unauthorized');
            }
        }
        
        // Handle order:paid event (successful purchase)
        if (event.event === 'order:paid') {
            const orderData = event.data;
            const customFields = orderData.custom_fields || {};
            
            // Extract Discord ID from custom fields
            let discordId = null;
            if (customFields.discord_id) {
                discordId = customFields.discord_id;
            } else if (customFields['Discord ID']) {
                discordId = customFields['Discord ID'];
            } else if (orderData.customer_email) {
                // Try to extract from email if it contains Discord ID
                const emailMatch = orderData.customer_email.match(/(\d{17,19})/);
                if (emailMatch) discordId = emailMatch[1];
            }
            
            if (!discordId) {
                console.log('⚠️ No Discord ID found in order:', orderData.uniqid);
                return res.status(200).send('No Discord ID provided');
            }
            
            // Get guild and member
            const guild = client.guilds.cache.get(config.sellixGuildId);
            if (!guild) {
                console.log('❌ Guild not found:', config.sellixGuildId);
                return res.status(200).send('Guild not found');
            }
            
            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member) {
                console.log('❌ Member not found:', discordId);
                
                // Store as pending purchase
                pendingPurchases[discordId] = {
                    orderId: orderData.uniqid,
                    amount: orderData.total,
                    email: orderData.customer_email,
                    product: orderData.product_title,
                    timestamp: Date.now(),
                    guildId: config.sellixGuildId
                };
                savePendingPurchases();
                console.log(`💾 Stored pending purchase for ${discordId}`);
                
                // Log pending purchase
                const logChannel = guild.channels.cache.get(config.sellixLogChannelId);
                if (logChannel) {
                    const pendingEmbed = new EmbedBuilder()
                        .setTitle('⏳ Purchase Pending - User Not in Server')
                        .setColor(0xFFA500)
                        .setDescription('Role will be assigned automatically when user joins the server.')
                        .addFields(
                            { name: '🆔 Order ID', value: orderData.uniqid, inline: true },
                            { name: '💰 Amount', value: `$${orderData.total}`, inline: true },
                            { name: '📧 Email', value: orderData.customer_email || 'N/A', inline: false },
                            { name: '🎮 Discord ID', value: discordId, inline: false },
                            { name: '📦 Product', value: orderData.product_title || 'Unknown', inline: false }
                        )
                        .setTimestamp();
                    await logChannel.send({ embeds: [pendingEmbed] });
                }
                
                return res.status(200).send('Purchase stored as pending');
            }
            
            // Assign role
            const role = guild.roles.cache.get(config.sellixRoleId);
            if (!role) {
                console.log('❌ Role not found:', config.sellixRoleId);
                return res.status(200).send('Role not found');
            }
            
            await member.roles.add(role);
            console.log(`✅ Assigned role to ${member.user.tag}`);
            
            // Send DM to user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('✅ Purchase Successful!')
                    .setDescription(`Thank you for your purchase! You have been given access to **${role.name}**.`)
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '🆔 Order ID', value: orderData.uniqid, inline: true },
                        { name: '💰 Amount Paid', value: `$${orderData.total}`, inline: true }
                    )
                    .setFooter({ text: guild.name })
                    .setTimestamp();
                
                await member.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Could not DM user:', error.message);
            }
            
            // Log purchase in channel
            const logChannel = guild.channels.cache.get(config.sellixLogChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ New Purchase')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: '👤 Customer', value: `${member.user.tag} (<@${member.id}>)`, inline: false },
                        { name: '🆔 Order ID', value: orderData.uniqid, inline: true },
                        { name: '💰 Amount', value: `$${orderData.total}`, inline: true },
                        { name: '📧 Email', value: orderData.customer_email || 'N/A', inline: false },
                        { name: '🎁 Role Given', value: role.name, inline: false },
                        { name: '📦 Product', value: orderData.product_title || 'Unknown', inline: false }
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Sellix webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ===== EBAY WEBHOOK SYSTEM =====
sellixApp.post('/ebay-webhook', async (req, res) => {
    try {
        console.log('📦 eBay webhook received:', JSON.stringify(req.body, null, 2));
        
        // eBay sends different notification types - we want ItemSold
        const notification = req.body;
        
        // eBay notification structure varies by API version
        // This handles both Trading API and Marketing API notifications
        let itemTitle, buyerUsername, salePrice, transactionId, itemId;
        
        // Trading API Platform Notifications format
        if (notification.NotificationEventName === 'ItemSold' || notification.eventType === 'ITEM_SOLD') {
            itemTitle = notification.Item?.Title || notification.itemTitle || 'Unknown Item';
            buyerUsername = notification.Buyer?.UserID || notification.buyerUsername || 'Unknown Buyer';
            salePrice = notification.Transaction?.TransactionPrice || notification.price || '0';
            transactionId = notification.Transaction?.TransactionID || notification.transactionId || 'N/A';
            itemId = notification.Item?.ItemID || notification.itemId || 'N/A';
        }
        // Alternative format for REST API
        else if (notification.eventType === 'marketplace.order.completed') {
            const order = notification.order || {};
            itemTitle = order.lineItems?.[0]?.title || 'Unknown Item';
            buyerUsername = order.buyer?.username || 'Unknown Buyer';
            salePrice = order.pricingSummary?.total?.value || '0';
            transactionId = order.orderId || 'N/A';
            itemId = order.lineItems?.[0]?.legacyItemId || 'N/A';
        }
        
        // Log notification to configured channel
        const logChannelId = config.ebayNotificationChannel || config.sellixNotificationChannel; // Fallback to Sellix channel
        
        if (logChannelId) {
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
            
            if (logChannel) {
                const saleEmbed = new EmbedBuilder()
                    .setTitle('🛒 eBay Sale Notification')
                    .setDescription('A new item has been sold on eBay!')
                    .setColor(0xE53238) // eBay red color
                    .addFields(
                        { name: '📦 Item', value: itemTitle, inline: false },
                        { name: '👤 Buyer', value: buyerUsername, inline: true },
                        { name: '💰 Price', value: `$${salePrice}`, inline: true },
                        { name: '🆔 Transaction ID', value: transactionId, inline: false },
                        { name: '🔢 Item ID', value: itemId, inline: true }
                    )
                    .setFooter({ text: 'eBay Platform Notifications' })
                    .setTimestamp();
                
                await logChannel.send({ embeds: [saleEmbed] });
                console.log(`✅ eBay sale notification sent for item: ${itemTitle}`);
            } else {
                console.warn('⚠️ eBay notification channel not found. Set ebayNotificationChannel in config.json');
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ eBay webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
});
// ===== END EBAY WEBHOOK SYSTEM =====

// Start webhook server on port 3000
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3000;
sellixApp.listen(WEBHOOK_PORT, () => {
    console.log(`🔗 Webhook server running on port ${WEBHOOK_PORT}`);
    console.log(`📍 Sellix webhook URL: http://YOUR_SERVER_IP:${WEBHOOK_PORT}/sellix-webhook`);
    console.log(`📍 eBay webhook URL: http://YOUR_SERVER_IP:${WEBHOOK_PORT}/ebay-webhook`);
});
// ===== END WEBHOOK SYSTEM =====

// Login to Discord with error handling
client.login(config.token).catch(error => {
    console.error('❌ Failed to login to Discord:', error);
    console.error('Please check your bot token in config.json');
    process.exit(1);
});
