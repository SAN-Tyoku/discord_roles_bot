import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, RoleSelectMenuBuilder, MessageFlags, EmbedBuilder, TextChannel } from 'discord.js';
import { dbGet, dbRun, GuildConfig, AuthApplication } from '../db';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';
import { isOptionalQuestion, stripOptionalMarker } from '../utils/questionHelper';

export const handleButton = async (interaction: ButtonInteraction) => {
    const { customId, guildId } = interaction;

    if (!guildId) return;

    if (customId === 'auth_start') {
        try {
            const blacklist = await dbGet('SELECT * FROM Blacklist WHERE user_id = ? AND guild_id = ?', [interaction.user.id, guildId]);
            if (blacklist) {
                await interaction.reply({ content: i18n.t('runtime.handlers.button.blacklistError', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }
            const existing = await dbGet('SELECT * FROM AuthApplications WHERE user_id = ? AND guild_id = ? AND status = "pending"', [interaction.user.id, guildId]);
            if (existing) {
                await interaction.reply({ content: i18n.t('runtime.handlers.modal.application.alreadyPending', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);
            const questions = JSON.parse(config?.modal_questions || '[]') as string[];

            if (questions.length === 0) {
                await interaction.reply({ content: i18n.t('runtime.handlers.button.noQuestions', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('auth_application_modal')
                .setTitle(i18n.t('runtime.handlers.modal.application.title', {}, interaction.locale));

            questions.forEach((q, i) => {
                const optional = isOptionalQuestion(q);
                const displayLabel = stripOptionalMarker(q);
                const input = new TextInputBuilder()
                    .setCustomId(`q_${i}`)
                    .setLabel(displayLabel.substring(0, 45))
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(!optional);

                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
            });

            await interaction.showModal(modal);

        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.common.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (customId === 'auth_cancel_application') {
        try {
            const pendingApp = await dbGet<AuthApplication>('SELECT * FROM AuthApplications WHERE user_id = ? AND guild_id = ? AND status = "pending"', [interaction.user.id, guildId]);

            if (!pendingApp) {
                await interaction.reply({ content: i18n.t('runtime.handlers.button.cancel.noPending', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            await dbRun('UPDATE AuthApplications SET status = "cancelled" WHERE id = ?', [pendingApp.id]);

            if (pendingApp.notification_message_id) {
                const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);
                if (config && config.notification_channel_id) {
                    try {
                        const channel = await interaction.guild?.channels.fetch(config.notification_channel_id) as TextChannel;
                        if (channel) {
                            const message = await channel.messages.fetch(pendingApp.notification_message_id).catch(() => null);
                            if (message) {
                                const oldEmbed = message.embeds[0];
                                if (oldEmbed) {
                                    const newEmbed = EmbedBuilder.from(oldEmbed)
                                        .setTitle(i18n.t('runtime.handlers.button.cancel.embedTitle', {}, interaction.guildLocale || undefined))
                                        .setColor(0x808080)
                                        .setFooter({ text: i18n.t('runtime.handlers.button.cancel.embedFooter', {}, interaction.guildLocale || undefined) });

                                    await message.edit({ embeds: [newEmbed], components: [] });
                                }
                            }
                        }
                    } catch (e) {
                        logger.warn('Failed to update notification message on cancel:', e);
                    }
                }
            }

            await interaction.reply({ content: i18n.t('runtime.handlers.button.cancel.success', {}, interaction.locale), flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.handlers.button.cancel.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (customId.startsWith('auth_approve_')) {
        const targetUserId = customId.split('_')[2];
        const messageId = interaction.message.id;

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId(`auth_role_select_${targetUserId}_${messageId}`)
            .setPlaceholder(i18n.t('runtime.handlers.button.approve.roleSelectPlaceholder', {}, interaction.locale))
            .setMinValues(1)
            .setMaxValues(10);

        const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);

        await interaction.reply({ content: i18n.t('runtime.handlers.button.approve.roleSelectMessage', {}, interaction.locale), components: [row], flags: MessageFlags.Ephemeral });

    } else if (customId.startsWith('auth_reject_')) {
        const targetUserId = customId.split('_')[2];

        const modal = new ModalBuilder()
            .setCustomId(`auth_reject_modal_${targetUserId}`)
            .setTitle(i18n.t('runtime.handlers.button.reject.modalTitle', {}, interaction.locale));

        const reasonInput = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel(i18n.t('runtime.handlers.button.reject.reasonLabel', {}, interaction.locale))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};
