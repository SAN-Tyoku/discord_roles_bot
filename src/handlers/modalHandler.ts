import { ModalSubmitInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, TextChannel, MessageFlags } from 'discord.js';
import { dbRun, dbGet, GuildConfig } from '../db';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';

export const handleModal = async (interaction: ModalSubmitInteraction) => {
    const { customId, guildId } = interaction;

    if (!guildId) return;

    if (customId === 'auth_panel_setup_modal') {
        const message = interaction.fields.getTextInputValue('panel_message');

        try {
            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

            if (!config || !config.notification_channel_id) {
                await interaction.reply({ content: i18n.t('runtime.handlers.modal.panelSetup.noChannel', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            if (config.panel_channel_id && config.panel_message_id) {
                try {
                    const oldChannel = await interaction.guild?.channels.fetch(config.panel_channel_id) as TextChannel;
                    if (oldChannel) {
                        const oldMessage = await oldChannel.messages.fetch(config.panel_message_id).catch(() => null);
                        if (oldMessage) await oldMessage.delete();
                    }
                } catch (e) {
                    logger.warn(i18n.t('runtime.handlers.modal.panelSetup.oldPanelDeleteError', {}, interaction.guildLocale || undefined), e);
                }
            }

            const channel = interaction.channel as TextChannel;
            if (!channel) {
                await interaction.reply({ content: i18n.t('runtime.handlers.modal.panelSetup.notTextChannel', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('auth_start')
                        .setLabel(i18n.t('runtime.handlers.modal.panelSetup.buttonLabel', {}, interaction.guildLocale || undefined))
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('auth_cancel_application')
                        .setLabel(i18n.t('runtime.handlers.modal.panelSetup.cancelLabel', {}, interaction.guildLocale || undefined))
                        .setStyle(ButtonStyle.Secondary)
                );

            const sentMessage = await channel.send({ content: message, components: [row] });

            if (config) {
                await dbRun('UPDATE GuildConfig SET panel_channel_id = ?, panel_message_id = ?, auth_panel_message = ? WHERE guild_id = ?',
                    [channel.id, sentMessage.id, message, guildId]);
            } else {
                await dbRun('INSERT INTO GuildConfig (guild_id, notification_channel_id, panel_channel_id, panel_message_id, auth_panel_message) VALUES (?, ?, ?, ?, ?)',
                    [guildId, null, channel.id, sentMessage.id, message]);
            }

            await interaction.reply({ content: i18n.t('runtime.handlers.modal.panelSetup.success', {}, interaction.locale), flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error(error);
            const err = error as { code?: number };
            if (err.code === 50013) {
                await interaction.reply({ content: i18n.t('runtime.handlers.modal.panelSetup.permissionError', {}, interaction.locale), flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: i18n.t('runtime.handlers.modal.panelSetup.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
            }
        }

    } else if (customId === 'auth_modal_config') {
        const questions: string[] = [];
        for (let i = 1; i <= 5; i++) {
            if (interaction.fields.fields.has(`question_${i}`)) {
                const q = interaction.fields.getTextInputValue(`question_${i}`);
                if (q && q.trim().length > 0) {
                    questions.push(q.trim());
                }
            }
        }

        try {
            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);
            const questionsJson = JSON.stringify(questions);

            if (config) {
                await dbRun('UPDATE GuildConfig SET modal_questions = ? WHERE guild_id = ?', [questionsJson, guildId]);
            } else {
                const defaultMessage = i18n.t('runtime.commands.auth.setup.placeholder', {}, interaction.locale);
                await dbRun('INSERT INTO GuildConfig (guild_id, modal_questions, auth_panel_message) VALUES (?, ?, ?)', [guildId, questionsJson, defaultMessage]);
            }

            await interaction.reply({ content: i18n.t('runtime.handlers.modal.questionConfig.success', { count: questions.length }, interaction.locale), flags: MessageFlags.Ephemeral });
        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.handlers.modal.questionConfig.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (customId === 'auth_application_modal') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const existing = await dbGet('SELECT * FROM AuthApplications WHERE user_id = ? AND guild_id = ? AND status = "pending"', [interaction.user.id, guildId]);
            if (existing) {
                await interaction.editReply(i18n.t('runtime.handlers.modal.application.alreadyPending', {}, interaction.locale));
                return;
            }

            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

            if (!config || !config.notification_channel_id) {
                await interaction.editReply(i18n.t('runtime.handlers.modal.application.noChannelError', {}, interaction.locale));
                return;
            }

            const questions = JSON.parse(config.modal_questions || '[]') as string[];
            const answers: string[] = [];

            for (let i = 0; i < questions.length; i++) {
                const val = interaction.fields.getTextInputValue(`q_${i}`);
                answers.push(val);
            }

            const now = Math.floor(Date.now() / 1000);

            const historyLimit = 30;
            const userHistory = await dbGet<{ count: number }>('SELECT COUNT(*) as count FROM AuthApplications WHERE user_id = ? AND guild_id = ?', [interaction.user.id, guildId]);

            if (userHistory && userHistory.count >= historyLimit) {
                await dbRun(`DELETE FROM AuthApplications WHERE id IN (
                    SELECT id FROM AuthApplications 
                    WHERE user_id = ? AND guild_id = ? 
                    ORDER BY applied_at ASC 
                    LIMIT ?
                )`, [interaction.user.id, guildId, userHistory.count - historyLimit + 1]);
            }

            await dbRun(`INSERT INTO AuthApplications (user_id, guild_id, status, answers, applied_at) VALUES (?, ?, 'pending', ?, ?) `,
                [interaction.user.id, guildId, JSON.stringify(answers), now]);

            const notificationChannel = await interaction.guild?.channels.fetch(config.notification_channel_id) as TextChannel;
            if (notificationChannel) {
                const questions = JSON.parse(config.modal_questions || '[]') as string[];

                const fields = questions.map((q, i) => ({
                    name: q,
                    value: answers[i] || i18n.t('runtime.common.none', {}, interaction.guildLocale || undefined),
                    inline: false
                }));

                const embed = new EmbedBuilder()
                    .setTitle(i18n.t('runtime.handlers.modal.application.title', {}, interaction.guildLocale || undefined))
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .addFields(
                        { name: i18n.t('runtime.handlers.modal.application.userId', {}, interaction.guildLocale || undefined), value: interaction.user.id, inline: true },
                        { name: i18n.t('runtime.handlers.modal.application.createdAt', {}, interaction.guildLocale || undefined), value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true },
                        ...fields
                    )
                    .setColor(0xFFFF00)
                    .setTimestamp();

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`auth_approve_${interaction.user.id}`)
                            .setLabel(i18n.t('runtime.handlers.modal.application.approve', {}, interaction.guildLocale || undefined))
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId(`auth_reject_${interaction.user.id}`)
                            .setLabel(i18n.t('runtime.handlers.modal.application.reject', {}, interaction.guildLocale || undefined))
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    );

                const sentMessage = await notificationChannel.send({ content: i18n.t('runtime.handlers.modal.application.notificationContent', { user: `<@${interaction.user.id}>` }, interaction.guildLocale || undefined), embeds: [embed], components: [row] });

                await dbRun('UPDATE AuthApplications SET notification_message_id = ? WHERE user_id = ? AND guild_id = ? AND status = "pending"',
                    [sentMessage.id, interaction.user.id, guildId]);
            }

            await interaction.editReply(i18n.t('runtime.handlers.modal.application.success', {}, interaction.locale));

        } catch (error) {
            logger.error(error);
            await interaction.editReply(i18n.t('runtime.handlers.modal.application.error', {}, interaction.locale));
        }
    } else if (customId.startsWith('auth_reject_modal_')) {
        const parts = customId.split('_');
        const targetUserId = parts.length > 3 ? parts[3] : '';
        const reason = interaction.fields.getTextInputValue('reject_reason');

        if (!targetUserId) return;

        try {
            await interaction.deferUpdate();

            const now = Math.floor(Date.now() / 1000);
            await dbRun('UPDATE AuthApplications SET status = ?, processed_at = ?, processor_id = ?, notes = ? WHERE user_id = ? AND guild_id = ? AND status = "pending"',
                ['rejected', now, interaction.user.id, reason, targetUserId, guildId]);

            if (interaction.message && interaction.message.embeds.length > 0) {
                const oldEmbed = interaction.message.embeds[0];
                if (oldEmbed) {
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor(0xFF0000)
                        .setTitle(i18n.t('runtime.handlers.modal.application.rejectedTitle', {}, interaction.guildLocale || undefined))
                        .addFields({ name: i18n.t('runtime.handlers.modal.application.rejectReason', {}, interaction.guildLocale || undefined), value: reason, inline: false }, { name: i18n.t('runtime.handlers.modal.application.processor', {}, interaction.guildLocale || undefined), value: interaction.user.tag, inline: true });

                    await interaction.message.edit({ embeds: [newEmbed], components: [] });
                }
            }

        } catch (error) {
            logger.error(error);
        }
    }
};
