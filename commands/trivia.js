const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// PlayStation trivia questions database
const TRIVIA_QUESTIONS = {
    ps3: [
        {
            question: 'What was the original PlayStation 3 exploit that allowed running homebrew?',
            answers: ['OtherOS++', 'PS3Xploit', 'Geohot Jailbreak', 'PSNPatch'],
            correct: 2
        },
        {
            question: 'Which firmware version is the last that can be downgraded on all PS3 models?',
            answers: ['3.56', '4.82', '4.90', '3.55'],
            correct: 3
        },
        {
            question: 'What does HEN stand for in PS3 modding?',
            answers: ['Hardware Enabler Network', 'Homebrew Enabler', 'Hacked Execution Node', 'Homebrew ENabler'],
            correct: 1
        },
        {
            question: 'What is the name of the PS3 backup manager tool?',
            answers: ['webMAN', 'multiMAN', 'IRISMAN', 'All of the above'],
            correct: 3
        }
    ],
    ps4: [
        {
            question: 'What is the latest exploitable PS4 firmware version?',
            answers: ['9.00', '11.00', '10.50', '11.50'],
            correct: 0
        },
        {
            question: 'Who is credited with the PS4 9.00 kernel exploit?',
            answers: ['TheFloW', 'ChendoChap', 'SpecterDev', 'CTurt'],
            correct: 1
        },
        {
            question: 'What does GoldHEN provide for PS4?',
            answers: ['Homebrew enabler', 'Backup loading', 'Debug settings', 'All of the above'],
            correct: 3
        },
        {
            question: 'What port is used for PS4 remote package installation?',
            answers: ['8080', '9090', '12800', '80'],
            correct: 1
        }
    ],
    ps5: [
        {
            question: 'What is the highest exploitable PS5 firmware?',
            answers: ['4.51', '5.50', '6.00', '3.00'],
            correct: 0
        },
        {
            question: 'Who developed the PS5 IPV6 kernel exploit?',
            answers: ['TheFloW', 'SpecterDev', 'flat_z', 'ChendoChap'],
            correct: 2
        },
        {
            question: 'Can PS5 consoles be downgraded?',
            answers: ['Yes, always', 'No, never', 'Only disc edition', 'Only with hardware modchip'],
            correct: 1
        }
    ],
    psp: [
        {
            question: 'What is the latest PSP firmware version?',
            answers: ['6.60', '6.61', '6.20', '5.50'],
            correct: 1
        },
        {
            question: 'What is the name of the PSP custom firmware?',
            answers: ['CFW PRO', 'ME CFW', 'Infinity', 'All of the above'],
            correct: 3
        },
        {
            question: 'What does ISO stand for in PSP gaming?',
            answers: ['International Standards Organization', 'Image Save Only', 'Game backup format', 'Internal System Operation'],
            correct: 2
        }
    ],
    vita: [
        {
            question: 'What is the PS Vita homebrew enabler called?',
            answers: ['VitaShell', 'HENkaku', 'Enso', 'TaiHEN'],
            correct: 1
        },
        {
            question: 'What is the highest exploitable PS Vita firmware?',
            answers: ['3.60', '3.65', '3.73', 'All versions'],
            correct: 3
        },
        {
            question: 'What does Enso provide for PS Vita?',
            answers: ['Permanent CFW', 'Homebrew apps', 'PS1 emulation', 'PSP emulation'],
            correct: 0
        }
    ],
    general: [
        {
            question: 'What year was the original PlayStation released?',
            answers: ['1994', '1995', '1996', '1993'],
            correct: 0
        },
        {
            question: 'What is PKG in PlayStation modding?',
            answers: ['Package file format', 'Patch Key Generator', 'PlayStation Kernel Gateway', 'Public Key Group'],
            correct: 0
        },
        {
            question: 'What does NoPayStation provide?',
            answers: ['Free PSN games', 'Game database links', 'Piracy tools', 'PSN account generator'],
            correct: 1
        }
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Play PlayStation trivia and earn economy points!')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Trivia category')
                .setRequired(false)
                .addChoices(
                    { name: 'PS3', value: 'ps3' },
                    { name: 'PS4', value: 'ps4' },
                    { name: 'PS5', value: 'ps5' },
                    { name: 'PSP', value: 'psp' },
                    { name: 'PS Vita', value: 'vita' },
                    { name: 'General', value: 'general' },
                    { name: 'Random', value: 'random' }
                )),
    async execute(interaction) {
        console.log('🎮 TRIVIA: Command triggered by', interaction.user.username);
        try {
            console.log('🎮 TRIVIA: Starting execution...');
            let category = interaction.options.getString('category') || 'random';
            console.log('🎮 TRIVIA: Category selected:', category);
            
            // Pick random category if random selected
            if (category === 'random') {
                const categories = ['ps3', 'ps4', 'ps5', 'psp', 'vita', 'general'];
                category = categories[Math.floor(Math.random() * categories.length)];
            }

            const questions = TRIVIA_QUESTIONS[category];
            const question = questions[Math.floor(Math.random() * questions.length)];

        // Create answer buttons
        const buttons = question.answers.map((answer, index) => 
            new ButtonBuilder()
                .setCustomId(`trivia_answer_${interaction.id}_${index}_${question.correct}`)
                .setLabel(answer)
                .setStyle(ButtonStyle.Primary)
        );

        const row1 = new ActionRowBuilder().addComponents(buttons.slice(0, 2));
        const row2 = new ActionRowBuilder().addComponents(buttons.slice(2, 4));

        const categoryEmojis = {
            ps3: '🎮',
            ps4: '🎯',
            ps5: '⚡',
            psp: '📱',
            vita: '🎨',
            general: '🌐'
        };

        const triviaEmbed = new EmbedBuilder()
            .setTitle(`${categoryEmojis[category]} PlayStation Trivia - ${category.toUpperCase()}`)
            .setDescription(question.question)
            .setColor(0x003087)
            .setFooter({ text: 'You have 30 seconds to answer! • Correct answer: +100 coins' })
            .setTimestamp();

        console.log('🎮 TRIVIA: Sending embed to user...');
        await interaction.reply({ embeds: [triviaEmbed], components: [row1, row2] });
        console.log('🎮 TRIVIA: Embed sent successfully!');

        // Store question data with expiry
        if (!global.activeTrivia) global.activeTrivia = {};
        global.activeTrivia[interaction.id] = {
            correct: question.correct,
            expires: Date.now() + 30000,
            answered: false
        };

        // Auto-expire after 30 seconds
        setTimeout(() => {
            if (global.activeTrivia[interaction.id] && !global.activeTrivia[interaction.id].answered) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`The correct answer was: **${question.answers[question.correct]}**`)
                    .setColor(0xFF0000);
                
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
                delete global.activeTrivia[interaction.id];
            }
        }, 30000);
        } catch (error) {
            console.error('❌ TRIVIA ERROR:', error);
            console.error('❌ TRIVIA STACK:', error.stack);
            await interaction.reply({ 
                content: '❌ An error occurred while starting the trivia game. Please try again!', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
};
