import { RoleSelectMenuInteraction, EmbedBuilder, TextChannel, Role, MessageFlags } from 'discord.js';
import { dbRun, GuildConfig, dbGet } from '../db';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';

export const handleSelectMenu = async (interaction: RoleSelectMenuInteraction) => {
    const { customId, guildId } = interaction;

    if (!guildId) return;

    if (customId.startsWith('auth_role_select_')) {
        const parts = customId.split('_');
        const targetUserId = parts.length > 3 ? parts[3] : undefined;
        const notificationMessageId = parts.length > 4 ? parts[4] : undefined;

        await interaction.update({ content: i18n.t('runtime.handlers.selectMenu.processing', {}, interaction.locale), components: [] });

        if (!targetUserId || !notificationMessageId) {
            await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.idNotFound', {}, interaction.locale));
            return;
        }

        const selectedRoles = interaction.roles;
        const member = await interaction.guild?.members.fetch(targetUserId).catch(() => null);

        if (!member) {
            await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.memberNotFound', {}, interaction.locale));
            return;
        }

        const actor = await interaction.guild?.members.fetch(interaction.user.id);
        const botMember = interaction.guild?.members.me;

        if (!actor || !botMember) {
            await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.userInfoFetchFailed', {}, interaction.locale));
            return;
        }

        const actorHighestRole = actor.roles.highest;
        const botHighestRole = botMember.roles.highest;

        const isOwner = interaction.guild?.ownerId === actor.id;

        for (const item of selectedRoles.values()) {
            let role: Role;
            if (item instanceof Role) {
                role = item;
            } else {
                const fetched = await interaction.guild?.roles.fetch(item.id);
                if (!fetched) {
                    await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.roleIdNotFound', { roleId: item.id }, interaction.locale));
                    return;
                }
                role = fetched;
            }

            if (role.comparePositionTo(botHighestRole) >= 0) {
                await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.roleHierarchyBot', { role: role.toString() }, interaction.locale));
                return;
            }

            if (!isOwner && role.comparePositionTo(actorHighestRole) >= 0) {
                await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.roleHierarchyUser', { role: role.toString(), actorRole: actorHighestRole.toString() }, interaction.locale));
                return;
            }
        }
        try {
            const rolesToAdd = selectedRoles.map(r => r.id);
            await member.roles.add(rolesToAdd);

            const now = Math.floor(Date.now() / 1000);
            await dbRun('UPDATE AuthApplications SET status = ?, processed_at = ?, processor_id = ? WHERE user_id = ? AND guild_id = ? AND status = "pending"',
                ['approved', now, interaction.user.id, targetUserId, guildId]);

            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);
            if (config && config.notification_channel_id) {
                const channel = await interaction.guild?.channels.fetch(config.notification_channel_id).catch(() => null) as TextChannel;
                if (channel) {
                    const message = await channel.messages.fetch(notificationMessageId).catch(() => null);
                    if (message && message.embeds.length > 0) {
                        const oldEmbed = message.embeds[0];
                        if (oldEmbed) {
                            const roleMentions = selectedRoles.map(r => r.toString()).join(', ');

                            const newEmbed = EmbedBuilder.from(oldEmbed)
                                .setColor(0x00FF00)
                                .setTitle(i18n.t('runtime.handlers.selectMenu.approved.embedTitle', {}, interaction.guildLocale || undefined))
                                .addFields(
                                    { name: i18n.t('runtime.handlers.selectMenu.approved.grantedRoles', {}, interaction.guildLocale || undefined), value: roleMentions, inline: false },
                                    { name: i18n.t('runtime.handlers.selectMenu.approved.approver', {}, interaction.guildLocale || undefined), value: interaction.user.tag, inline: true }
                                );

                            await message.edit({ embeds: [newEmbed], components: [] });
                        }
                    }
                }
            }

            if (config && config.dm_notification_enabled === 1) {
                try {
                    await member.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(i18n.t('runtime.handlers.selectMenu.dm.title', {}, interaction.guildLocale || undefined))
                                .setDescription(i18n.t('runtime.handlers.selectMenu.dm.description', { guild: interaction.guild?.name || i18n.t('runtime.common.server', {}, interaction.locale) }, interaction.guildLocale || undefined))
                                .addFields({ name: i18n.t('runtime.handlers.selectMenu.approved.grantedRoles', {}, interaction.guildLocale || undefined), value: selectedRoles.map(r => r.name).join(', '), inline: false })
                                .setColor(0x00FF00)
                                .setTimestamp()
                        ]
                    });
                } catch (dmError) {
                    logger.warn(`Failed to send DM to user ${targetUserId} (possibly DM disabled):`, dmError);
                }
            }

            await interaction.editReply(i18n.t('runtime.handlers.selectMenu.success', { count: selectedRoles.size }, interaction.locale));

        } catch (error) {
            logger.error(error);
            await interaction.editReply(i18n.t('runtime.handlers.selectMenu.error.generic', {}, interaction.locale));
        }
    }
};
