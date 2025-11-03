const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clean')
        .setDescription('Delete a specified number of messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch messages
            const messages = await interaction.channel.messages.fetch({ limit: amount + 1 });
            
            if (targetUser) {
                // Filter messages by user
                const userMessages = messages.filter(msg => msg.author.id === targetUser.id);
                
                if (userMessages.size === 0) {
                    return await interaction.editReply({ 
                        content: `❌ No messages found from ${targetUser.username} in the last ${amount} messages!` 
                    });
                }

                // Delete filtered messages
                const deleted = await interaction.channel.bulkDelete(userMessages, true);
                
                await interaction.editReply({ 
                    content: `✅ Successfully deleted **${deleted.size}** message(s) from ${targetUser.username}!` 
                });
            } else {
                // Delete all messages
                const deleted = await interaction.channel.bulkDelete(amount, true);
                
                await interaction.editReply({ 
                    content: `✅ Successfully deleted **${deleted.size}** message(s)!` 
                });
            }

            // Auto-delete confirmation after 5 seconds
            setTimeout(() => {
                interaction.deleteReply().catch(() => {});
            }, 5000);

        } catch (error) {
            console.error('Error deleting messages:', error);
            
            let errorMessage = '❌ Failed to delete messages!';
            
            if (error.code === 50034) {
                errorMessage = '❌ Cannot delete messages older than 14 days!';
            } else if (error.code === 50013) {
                errorMessage = '❌ I don\'t have permission to delete messages!';
            }
            
            await interaction.editReply({ content: errorMessage });
        }
    }
};
