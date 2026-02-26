import { ChatInputCommandInteraction, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { dbRun, dbGet, dbAll, GuildConfig, AuthApplication, BlacklistEntry } from '../db';
import logger from '../utils/logger';
import { i18n } from '../utils/i18n';
import { stripOptionalMarker } from '../utils/questionHelper';

/**
 * Handles interactions for the /auth command.
 * Manages subcommands such as blacklist management, authentication panel setup, question configuration,
 * setting display, history display, application cancellation, and status display.
 * @param {ChatInputCommandInteraction} interaction - The chat command interaction to process.
 */
export const handleAuthCommand = async (interaction: ChatInputCommandInteraction) => {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({ content: i18n.t('runtime.common.guildOnly', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        return;
    }

    if (subcommandGroup === 'blacklist') {
        if (subcommand === 'add') {
            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') || i18n.t('runtime.commands.auth.blacklist.defaultReason', {}, interaction.locale);
            const now = Math.floor(Date.now() / 1000);

            try {
                await dbRun('INSERT OR REPLACE INTO Blacklist (user_id, guild_id, reason, added_at, added_by) VALUES (?, ?, ?, ?, ?)',
                    [user.id, guildId, reason, now, interaction.user.id]);
                await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.added', { user: user.tag }, interaction.locale), flags: MessageFlags.Ephemeral });
            } catch (error) {
                logger.error(error);
                await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.error.add', {}, interaction.locale), flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'remove') {
            const user = interaction.options.getUser('user', true);
            try {
                await dbRun('DELETE FROM Blacklist WHERE user_id = ? AND guild_id = ?', [user.id, guildId]);
                await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.removed', { user: user.tag }, interaction.locale), flags: MessageFlags.Ephemeral });
            } catch (error) {
                logger.error(error);
                await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.error.remove', {}, interaction.locale), flags: MessageFlags.Ephemeral });
            }
        } else if (subcommand === 'list') {
            try {
                const list = await dbAll<BlacklistEntry>('SELECT * FROM Blacklist WHERE guild_id = ?', [guildId]);
                if (list.length === 0) {
                    await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.empty', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                    return;
                }

                const description = list.map(entry => `<@${entry.user_id}> - ${entry.reason}`).join('\n');
                const embed = new EmbedBuilder()
                    .setTitle(i18n.t('runtime.commands.auth.blacklist.header', {}, interaction.locale))
                    .setDescription(description.substring(0, 4096))
                    .setColor(0xFF0000);

                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            } catch (error) {
                logger.error(error);
                await interaction.reply({ content: i18n.t('runtime.commands.auth.blacklist.error.list', {}, interaction.locale), flags: MessageFlags.Ephemeral });
            }
        }
        return;
    }

    if (subcommand === 'setup') {

        const modal = new ModalBuilder()
            .setCustomId('auth_panel_setup_modal')
            .setTitle(i18n.t('runtime.commands.auth.setup.panelTitle', {}, interaction.locale));

        const messageInput = new TextInputBuilder()
            .setCustomId('panel_message')
            .setLabel(i18n.t('runtime.commands.auth.setup.messageLabel', {}, interaction.locale))
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(i18n.t('runtime.commands.auth.setup.placeholder', {}, interaction.locale))
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);

    } else if (subcommand === 'channel') {
        const channel = interaction.options.getChannel('target', true);

        try {
            const existingConfig = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

            if (existingConfig) {
                await dbRun('UPDATE GuildConfig SET notification_channel_id = ? WHERE guild_id = ?', [channel.id, guildId]);
            } else {
                const defaultMessage = i18n.t('runtime.commands.auth.setup.placeholder', {}, interaction.locale);
                await dbRun('INSERT INTO GuildConfig (guild_id, notification_channel_id, auth_panel_message) VALUES (?, ?, ?)', [guildId, channel.id, defaultMessage]);
            }

            await interaction.reply({ content: i18n.t('runtime.commands.auth.channel.success', { channel: channel.toString() }, interaction.locale), flags: MessageFlags.Ephemeral });
        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.channel.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (subcommand === 'modal') {
        const modal = new ModalBuilder()
            .setCustomId('auth_modal_config')
            .setTitle(i18n.t('runtime.commands.auth.modal.title', {}, interaction.locale));

        const rows: ActionRowBuilder<TextInputBuilder>[] = [];
        for (let i = 1; i <= 5; i++) {
            const input = new TextInputBuilder()
                .setCustomId(`question_${i}`)
                .setLabel(i18n.t('runtime.commands.auth.modal.label', { index: i }, interaction.locale))
                .setStyle(TextInputStyle.Short)
                .setMaxLength(45)
                .setRequired(false);

            if (i === 1) {
                input.setPlaceholder(i18n.t('runtime.commands.auth.modal.optionalHint', {}, interaction.locale));
            }

            rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        }

        modal.addComponents(...rows);
        await interaction.showModal(modal);

    } else if (subcommand === 'config') {
        try {
            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

            if (!config) {
                await interaction.reply({ content: i18n.t('runtime.commands.auth.config.notFound', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            const questions = JSON.parse(config.modal_questions || '[]') as string[];
            const questionList = questions.length > 0 ? questions.map((q, i) => `${i + 1}. ${stripOptionalMarker(q)}`).join('\n') : i18n.t('runtime.common.notSet', {}, interaction.locale);

            const embed = new EmbedBuilder()
                .setTitle(i18n.t('runtime.commands.auth.config.title', {}, interaction.locale))
                .addFields(
                    { name: i18n.t('runtime.commands.auth.config.channel', {}, interaction.locale), value: config.notification_channel_id ? `<#${config.notification_channel_id}>` : i18n.t('runtime.common.notSet', {}, interaction.locale) },
                    { name: i18n.t('runtime.commands.auth.config.panel', {}, interaction.locale), value: config.panel_channel_id ? `<#${config.panel_channel_id}>` : i18n.t('runtime.common.notSet', {}, interaction.locale) },
                    { name: i18n.t('runtime.commands.auth.config.questions', {}, interaction.locale), value: questionList }
                )
                .setColor(0x00FF00);

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.config.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (subcommand === 'history') {
        const user = interaction.options.getUser('user', true);
        try {
            const history = await dbAll<AuthApplication>('SELECT * FROM AuthApplications WHERE user_id = ? AND guild_id = ? ORDER BY applied_at DESC LIMIT 10', [user.id, guildId]);

            if (history.length === 0) {
                await interaction.reply({ content: i18n.t('runtime.commands.auth.history.empty', {}, interaction.locale), flags: MessageFlags.Ephemeral });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(i18n.t('runtime.commands.auth.history.title', { user: user.tag }, interaction.locale))
                .setColor(0x0099FF);

            history.forEach(app => {
                const date = new Date(app.applied_at * 1000).toLocaleString(interaction.locale);
                let statusEmoji = '❓';
                if (app.status === 'approved') statusEmoji = '✅';
                if (app.status === 'rejected') statusEmoji = '❌';
                if (app.status === 'pending') statusEmoji = '⏳';
                if (app.status === 'cancelled') statusEmoji = '🚫';

                const notes = app.notes ? `\n${i18n.t('runtime.commands.auth.history.notes', {}, interaction.locale)}: ${app.notes}` : '';
                const processor = app.processor_id ? `\n${i18n.t('runtime.commands.auth.history.processor', {}, interaction.locale)}: <@${app.processor_id}>` : '';

                embed.addFields({
                    name: `${statusEmoji} ${date}`,
                    value: `${i18n.t('runtime.commands.auth.history.status', {}, interaction.locale)}: ${app.status}${processor}${notes}`,
                    inline: false
                });
            });

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.history.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }

    } else if (subcommand === 'dm_notification') {
        const enable = interaction.options.getBoolean('enable', true);
        const dm_notification_value = enable ? 1 : 0;

        try {
            const existingConfig = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);

            if (existingConfig) {
                await dbRun('UPDATE GuildConfig SET dm_notification_enabled = ? WHERE guild_id = ?', [dm_notification_value, guildId]);
            } else {
                const defaultMessage = i18n.t('runtime.commands.auth.setup.placeholder', {}, interaction.locale);
                await dbRun('INSERT INTO GuildConfig (guild_id, dm_notification_enabled, auth_panel_message) VALUES (?, ?, ?)', [guildId, dm_notification_value, defaultMessage]);
            }
            const status = enable ? i18n.t('runtime.commands.auth.dm_notification.status.enabled', {}, interaction.locale) : i18n.t('runtime.commands.auth.dm_notification.status.disabled', {}, interaction.locale);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.dm_notification.success', { status }, interaction.locale), flags: MessageFlags.Ephemeral });
        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.dm_notification.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }
    } else if (subcommand === 'status') {
        try {
            const config = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', [guildId]);
            const stats = await dbAll<{ status: string, count: number }>('SELECT status, COUNT(*) as count FROM AuthApplications WHERE guild_id = ? GROUP BY status', [guildId]);

            const counts = {
                pending: 0,
                approved: 0,
                rejected: 0,
                expired: 0
            };

            stats.forEach(row => {
                if (row.status in counts) {
                    counts[row.status as keyof typeof counts] = row.count;
                }
            });

            const uptimeSeconds = process.uptime();
            const uptime = `${Math.floor(uptimeSeconds / 3600)}${i18n.t('runtime.common.hours', {}, interaction.locale)} ${Math.floor((uptimeSeconds % 3600) / 60)}${i18n.t('runtime.common.minutes', {}, interaction.locale)}`;
            const ping = Math.round(interaction.client.ws.ping);

            const embed = new EmbedBuilder()
                .setTitle(i18n.t('runtime.commands.auth.status.title', {}, interaction.locale))
                .setColor(0x0099FF)
                .addFields(
                    {
                        name: i18n.t('runtime.commands.auth.status.applicationStats', {}, interaction.locale),
                        value: `${i18n.t('runtime.commands.auth.status.pending', { count: counts.pending }, interaction.locale)}\n${i18n.t('runtime.commands.auth.status.approved', { count: counts.approved }, interaction.locale)}\n${i18n.t('runtime.commands.auth.status.rejected', { count: counts.rejected }, interaction.locale)}`,
                        inline: false
                    },
                    {
                        name: i18n.t('runtime.commands.auth.status.configStats', {}, interaction.locale),
                        value: `**${i18n.t('runtime.commands.auth.status.notificationChannel', {}, interaction.locale)}:** ${config?.notification_channel_id ? `<#${config.notification_channel_id}>` : i18n.t('runtime.common.notSet', {}, interaction.locale)}\n**${i18n.t('runtime.commands.auth.status.panel', {}, interaction.locale)}:** ${config?.panel_channel_id ? `<#${config.panel_channel_id}>` : i18n.t('runtime.common.notSet', {}, interaction.locale)}\n**${i18n.t('runtime.commands.auth.status.dmNotification', {}, interaction.locale)}:** ${config?.dm_notification_enabled ? i18n.t('runtime.common.enabled', {}, interaction.locale) : i18n.t('runtime.common.disabled', {}, interaction.locale)}`,
                        inline: true
                    },
                    {
                        name: i18n.t('runtime.commands.auth.status.systemStats', {}, interaction.locale),
                        value: `**${i18n.t('runtime.commands.auth.status.ping', {}, interaction.locale)}:** ${ping}ms\n**${i18n.t('runtime.commands.auth.status.uptime', {}, interaction.locale)}:** ${uptime}`,
                        inline: true
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            logger.error(error);
            await interaction.reply({ content: i18n.t('runtime.commands.auth.status.error', {}, interaction.locale), flags: MessageFlags.Ephemeral });
        }
    }
};