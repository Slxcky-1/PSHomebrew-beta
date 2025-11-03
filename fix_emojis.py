import codecs

# Read the file
with codecs.open('bot.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace corrupted emojis with proper ones
replacements = {
    "name: '❓ Leveling System'": "name: '📊 Leveling System'",
    "name: '� Error Codes'": "name: '⚠️ Error Codes'",
    "name: '� AI Chat'": "name: '🤖 AI Chat'",
    "name: '✅ Welcome Messages'": "name: '👋 Welcome Messages'",
    "name: '✅ Leave Messages'": "name: '👋 Leave Messages'",
    "name: '� Ticket System'": "name: '🎫 Ticket System'",
    "name: '� Raid Protection'": "name: '🛡️ Raid Protection'",
    "name: '� Auto Nickname'": "name: '✏️ Auto Nickname'",
    "name: '� YouTube Notifs'": "name: '📺 YouTube Notifs'",
    "name: '� Server Stats'": "name: '📊 Server Stats'",
    "name: '� Custom Commands'": "name: '⚙️ Custom Commands'",
    "name: '� Moderation Logging'": "name: '📝 Moderation Logging'",
    "name: '� Multi-Language'": "name: '🌍 Multi-Language'",
    "name: '� AI Optimization'": "name: '⚡ AI Optimization'",
    "name: '� Bot Customization'": "name: '🎨 Bot Customization'"
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Write back
with codecs.open('bot.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Emojis updated successfully!")
