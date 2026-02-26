import {
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandGroupBuilder,
    SlashCommandChannelOption,
    SlashCommandUserOption,
    SlashCommandStringOption,
    SlashCommandBooleanOption,
    SlashCommandRoleOption,
} from 'discord.js';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config({ quiet: true });

import { applyLocales, applyChoiceLocales } from '../utils/deployHelpers';

const commands = [
    applyLocales(new SlashCommandBuilder(), 'commands.auth')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.help'),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.setup'),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.channel').addChannelOption(
                (option: SlashCommandChannelOption) =>
                    applyLocales(option, 'commands.auth.subcommands.channel.options.target').setRequired(true),
            ),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.modal'),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.config'),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.status'),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.dm_notification').addBooleanOption(
                (option: SlashCommandBooleanOption) =>
                    applyLocales(option, 'commands.auth.subcommands.dm_notification.options.enable').setRequired(true),
            ),
        )
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            applyLocales(subcommand, 'commands.auth.subcommands.history').addUserOption(
                (option: SlashCommandUserOption) =>
                    applyLocales(option, 'commands.auth.subcommands.history.options.user').setRequired(true),
            ),
        )
        .addSubcommandGroup((group: SlashCommandSubcommandGroupBuilder) =>
            applyLocales(group, 'commands.auth.subcommands.blacklist')
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    applyLocales(subcommand, 'commands.auth.subcommands.blacklist.subcommands.add')
                        .addUserOption((option: SlashCommandUserOption) =>
                            applyLocales(
                                option,
                                'commands.auth.subcommands.blacklist.subcommands.add.options.user',
                            ).setRequired(true),
                        )
                        .addStringOption((option: SlashCommandStringOption) =>
                            applyLocales(
                                option,
                                'commands.auth.subcommands.blacklist.subcommands.add.options.reason',
                            ).setRequired(false),
                        ),
                )
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    applyLocales(subcommand, 'commands.auth.subcommands.blacklist.subcommands.remove').addUserOption(
                        (option: SlashCommandUserOption) =>
                            applyLocales(
                                option,
                                'commands.auth.subcommands.blacklist.subcommands.remove.options.user',
                            ).setRequired(true),
                    ),
                )
                .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
                    applyLocales(subcommand, 'commands.auth.subcommands.blacklist.subcommands.list'),
                ),
        ),
    applyLocales(new SlashCommandBuilder(), 'commands.manage_role')
        .addUserOption((option: SlashCommandUserOption) =>
            applyLocales(option, 'commands.manage_role.options.user').setRequired(true),
        )
        .addRoleOption((option: SlashCommandRoleOption) =>
            applyLocales(option, 'commands.manage_role.options.role').setRequired(true),
        )
        .addStringOption((option: SlashCommandStringOption) => {
            applyLocales(option, 'commands.manage_role.options.action').setRequired(true);

            const choices = applyChoiceLocales(
                [
                    { name: 'Grant', value: 'add' },
                    { name: 'Remove', value: 'remove' },
                ],
                'commands.manage_role.options.action.choices',
            );

            option.addChoices(...choices);
            return option;
        }),
].map((command) => command.toJSON());

export async function deployCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN as string);

    try {
        logger.info('Started refreshing application (/) commands.');

        if (process.env.APPLICATION_ID) {
            await rest.put(Routes.applicationCommands(process.env.APPLICATION_ID as string), { body: commands });
            logger.info('Successfully reloaded global application (/) commands.');
        } else {
            logger.warn('APPLICATION_ID is not set in .env. Skipping command deployment.');
        }
    } catch (error) {
        logger.error('Error occurred during command deployment:', error);
    }
}

deployCommands();
