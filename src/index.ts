/**
 * Entry point for the Discord Role Bot.
 * Loads environment variables, initializes the Discord client,
 * and dynamically loads event handlers.
 */
import fs from 'fs';
import path from 'path';
import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import logger from './utils/logger';

dotenv.config({ quiet: true });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const isDevelopment = path.extname(__filename) === '.ts';
const eventFileExtension = isDevelopment ? '.ts' : '.js';

const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(eventFileExtension));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const event = require(filePath).default;

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Global error handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.login(process.env.BOT_TOKEN);