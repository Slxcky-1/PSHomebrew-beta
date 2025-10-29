import re

# Read the file
with open('bot.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the features section
old_section = r"\.addFields\(\s+\{\s+name: `⭐ Leveling System.*?inline: false\s+\}\s+\)"

new_section = """.addFields(
                {
                    name: '⭐ Leveling System',
                    value: `**${settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled'}**\\n` +
                           `Earn **${settings.leveling.minXP}-${settings.leveling.maxXP} XP** per message\\n` +
                           `**${settings.leveling.cooldown / 1000}s** cooldown between gains\\n` +
                           `**${settings.leveling.maxLevel} levels** total`,
                    inline: true
                },
                {
                    name: '🎮 PS3 Error Codes',
                    value: `**${settings.keywords.enabled ? '✅ Enabled' : '❌ Disabled'}**\\n` +
                           `Detects **${Object.keys(ps3ErrorCodes).length} error codes**\\n` +
                           `Type a code for instant help\\n` +
                           `Example: \`80710016\``,
                    inline: true
                },
                {
                    name: '\\u200B',
                    value: '\\u200B',
                    inline: true
                },
                {
                    name: '👋 Welcome Messages',
                    value: `**${settings.welcome.enabled ? '✅ Enabled' : '❌ Disabled'}**\\n` +
                           `Channel: **#${settings.welcome.channelName}**\\n` +
                           `${settings.welcome.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                },
                {
                    name: '👋 Leave Messages',
                    value: `**${settings.leave.enabled ? '✅ Enabled' : '❌ Disabled'}**\\n` +
                           `Channel: **#${settings.leave.channelName}**\\n` +
                           `${settings.leave.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                }
            )"""

content = re.sub(old_section, new_section, content, flags=re.DOTALL)

# Also fix the footer
content = content.replace(
    ".setFooter({ text: 'PSHomebrew Community Bot • Use /help for commands' })",
    ".setFooter({ text: 'Use /viewsettings to see all server settings' })"
)

# Write back
with open('bot.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Features section updated!")
