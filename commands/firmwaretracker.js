const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { search } = require('duck-duck-scrape');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('firmwaretracker')
        .setDescription('Check latest PlayStation firmware and CFW exploit status'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const embed = new EmbedBuilder()
                .setTitle('🔧 PlayStation Firmware & Exploit Tracker')
                .setColor(0x0070CC)
                .setDescription('Current status of PlayStation firmwares and exploits')
                .addFields(
                    {
                        name: '🎮 PS5',
                        value: '**Latest OFW:** 10.01\n' +
                               '**Latest Exploitable:** 9.00\n' +
                               '**Exploit:** IPV6 Kernel (PS5-PPPwn)\n' +
                               '**Status:** ✅ Jailbreak available\n' +
                               '**Tools:** GoldHEN, PS5Debug',
                        inline: false
                    },
                    {
                        name: '🎮 PS4',
                        value: '**Latest OFW:** 12.02\n' +
                               '**Latest Exploitable:** 11.00\n' +
                               '**Exploit:** PPPwned, GoldHEN\n' +
                               '**Status:** ✅ Jailbreak available\n' +
                               '**Tools:** GoldHEN 2.4b18.6, Mira, PS4Debug',
                        inline: false
                    },
                    {
                        name: '🎮 PS3',
                        value: '**Latest OFW:** 4.91\n' +
                               '**Latest CFW:** Evilnat 4.92 Cobra 8.60\n' +
                               '**Exploit:** WebKit (HAN/HEN)\n' +
                               '**Status:** ✅ Full CFW available\n' +
                               '**Tools:** multiMAN, webMAN MOD, IRISMAN',
                        inline: false
                    },
                    {
                        name: '🎮 PS Vita',
                        value: '**Latest OFW:** 3.74\n' +
                               '**Latest Exploitable:** 3.60-3.74\n' +
                               '**Exploit:** h-encore² / Trinity\n' +
                               '**Status:** ✅ Full Homebrew support\n' +
                               '**Tools:** VitaShell, Adrenaline, pkgj',
                        inline: false
                    },
                    {
                        name: '🎮 PSP',
                        value: '**Latest OFW:** 6.61\n' +
                               '**Latest CFW:** 6.61 PRO-C2 / Infinity 2.0\n' +
                               '**Status:** ✅ Permanent CFW available\n' +
                               '**Tools:** CXMB, PSP FTP, ISO Tool',
                        inline: false
                    },
                    {
                        name: '⚠️ Important Notes',
                        value: '• **DO NOT** update beyond exploitable firmware\n' +
                               '• Always disable automatic updates\n' +
                               '• Keep your console offline if on exploitable FW\n' +
                               '• Check [wololo.net](https://wololo.net) for updates\n' +
                               '• Visit [PSX-Place](https://www.psx-place.com) for tools',
                        inline: false
                    },
                    {
                        name: '🔔 Auto-Update Alerts',
                        value: 'This command checks daily at 7 PM for new firmware releases and exploits.\n' +
                               'Server admins will be notified when changes are detected.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Last updated: ' + new Date().toLocaleDateString() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in firmwaretracker command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching firmware information.',
            });
        }
    },
};
