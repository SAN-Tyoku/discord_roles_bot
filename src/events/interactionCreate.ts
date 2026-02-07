import { Events, Interaction, MessageFlags } from 'discord.js';
import { handleCommand } from '../handlers/commandHandler';
import { handleModal } from '../handlers/modalHandler';
import { handleButton } from '../handlers/buttonHandler';
import { handleSelectMenu } from '../handlers/selectMenuHandler';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';

export default {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction: Interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                await handleCommand(interaction);
            } else if (interaction.isModalSubmit()) {
                await handleModal(interaction);
            } else if (interaction.isButton()) {
                await handleButton(interaction);
            } else if (interaction.isRoleSelectMenu()) {
                await handleSelectMenu(interaction);
            }
        } catch (error) {
            logger.error('Interaction error:', error);

            if (interaction.isRepliable()) {
                try {
                    const message = { content: i18n.t('runtime.common.interactionError', {}, interaction.locale), ephemeral: true };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(message);
                    } else {
                        await interaction.reply(message);
                    }
                } catch (sendError) {
                    logger.error('Failed to send error notification:', sendError);
                }
            }
        }
    },
};
