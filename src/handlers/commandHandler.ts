import { ChatInputCommandInteraction } from 'discord.js';
import { handleAuthCommand } from '../commands/auth';
import { handleManageRoleCommand } from '../commands/manageRole';

/**
 * Handles chat command interactions and routes them to the appropriate command handler.
 * @param {ChatInputCommandInteraction} interaction - The chat command interaction to process.
 */
export const handleCommand = async (interaction: ChatInputCommandInteraction) => {
    const { commandName } = interaction;

    if (commandName === 'auth') {
        await handleAuthCommand(interaction);
    } else if (commandName === 'manage_role') {
        await handleManageRoleCommand(interaction);
    }
};
