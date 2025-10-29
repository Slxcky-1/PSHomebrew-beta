$content = Get-Content -Path "bot.js" -Raw -Encoding UTF8

# Replace the entire addFields section with clean version
$pattern = '\.addFields\(\s+\{[\s\S]*?inline: false\s+\}\s+\)'

$replacement = @'
.addFields(
                {
                    name: '⭐ Leveling System',
                    value: `**${settings.leveling.enabled ? '✅ Enabled' : '❌ Disabled'}**\n` +
                           `Earn **${settings.leveling.minXP}-${settings.leveling.maxXP} XP** per message\n` +
                           `**${settings.leveling.cooldown / 1000}s** cooldown between gains\n` +
                           `**${settings.leveling.maxLevel} levels** total`,
                    inline: true
                },
                {
                    name: '🎮 PS3 Error Codes',
                    value: `**${settings.keywords.enabled ? '✅ Enabled' : '❌ Disabled'}**\n` +
                           `Detects **${Object.keys(ps3ErrorCodes).length} error codes**\n` +
                           `Type a code for instant help\n` +
                           `Example: ``80710016````,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '\u200B',
                    inline: true
                },
                {
                    name: '👋 Welcome Messages',
                    value: `**${settings.welcome.enabled ? '✅ Enabled' : '❌ Disabled'}**\n` +
                           `Channel: **#${settings.welcome.channelName}**\n` +
                           `${settings.welcome.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                },
                {
                    name: '👋 Leave Messages',
                    value: `**${settings.leave.enabled ? '✅ Enabled' : '❌ Disabled'}**\n` +
                           `Channel: **#${settings.leave.channelName}**\n` +
                           `${settings.leave.customMessage ? '✅ Custom message' : '📝 Default message'}`,
                    inline: true
                }
            )
'@

$content = $content -replace $pattern, $replacement

# Also update the footer
$content = $content.Replace(
    ".setFooter({ text: 'PSHomebrew Community Bot • Use /help for commands' })",
    ".setFooter({ text: 'Use /viewsettings to see all server settings' })"
)

$content | Set-Content -Path "bot.js" -Encoding UTF8 -NoNewline

Write-Host "Features section updated successfully!"
