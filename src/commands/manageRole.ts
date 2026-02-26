import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { dbGet, GuildConfig } from '../db';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';

export const handleManageRoleCommand = async (interaction: ChatInputCommandInteraction) => {
    const user = interaction.options.getUser('user', true);
    const role = interaction.options.getRole('role', true);
    const action = interaction.options.getString('action', true);
    const guildId = interaction.guildId;

    if (!guildId || !interaction.guild) {
        await interaction.reply({
            content: i18n.t('runtime.common.guildOnly', {}, interaction.locale),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

        let hasPermission = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

        if (!hasPermission && config && config.notification_channel_id) {
            const channel = interaction.guild.channels.cache.get(config.notification_channel_id);
            const fetchedChannel =
                channel || (await interaction.guild.channels.fetch(config.notification_channel_id).catch(() => null));

            if (
                fetchedChannel &&
                fetchedChannel.permissionsFor(interaction.user.id)?.has(PermissionFlagsBits.ViewChannel)
            ) {
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            await interaction.reply({
                content: i18n.t('runtime.common.permissionDenied', {}, interaction.locale),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const targetRole = await interaction.guild.roles.fetch(role.id);
        if (!targetRole) {
            await interaction.reply({
                content: i18n.t('runtime.commands.manageRole.notFound', {}, interaction.locale),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const botMember = interaction.guild.members.me;
        const actor = await interaction.guild.members.fetch(interaction.user.id);
        const actorHighestRole = actor.roles.highest;
        const isOwner = interaction.guild.ownerId === actor.id;

        if (botMember && targetRole.comparePositionTo(botMember.roles.highest) >= 0) {
            await interaction.reply({
                content: i18n.t(
                    'runtime.commands.manageRole.hierarchyErrorBot',
                    { role: targetRole.toString() },
                    interaction.locale,
                ),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (!isOwner && targetRole.comparePositionTo(actorHighestRole) >= 0) {
            await interaction.reply({
                content: i18n.t(
                    'runtime.commands.manageRole.hierarchyErrorUser',
                    { role: targetRole.toString(), actorRole: actorHighestRole.toString() },
                    interaction.locale,
                ),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const member = await interaction.guild.members.fetch(user.id);

        if (action === 'add') {
            await member.roles.add(role.id);
            await interaction.reply({
                content: i18n.t(
                    'runtime.commands.manageRole.successAdd',
                    { user: user.toString(), role: role.toString() },
                    interaction.locale,
                ),
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await member.roles.remove(role.id);
            await interaction.reply({
                content: i18n.t(
                    'runtime.commands.manageRole.successRemove',
                    { user: user.toString(), role: role.toString() },
                    interaction.locale,
                ),
                flags: MessageFlags.Ephemeral,
            });
        }
    } catch (error) {
        logger.error(error);
        await interaction.reply({
            content: i18n.t('runtime.commands.manageRole.error', {}, interaction.locale),
            flags: MessageFlags.Ephemeral,
        });
    }
};
