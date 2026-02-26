import { Client, Events } from 'discord.js';
import { initDb } from '../db';
import logger from '../utils/logger';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client) {
        logger.info(`Logged in as ${client.user?.tag}`);

        await initDb();
        logger.info('Database initialized.');
    },
};
