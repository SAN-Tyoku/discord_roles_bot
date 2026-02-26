import winston from 'winston';
import path from 'path';
import fs from 'fs';

const { combine, timestamp, printf, colorize, align } = winston.format;

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
    level: logLevel,
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        printf(({ level, message, timestamp, stack }) => {
            return `${timestamp} [${level}]: ${stack || message}`;
        }),
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            level: logLevel,
            maxsize: 5242880,
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
    ],
});

/**
 * Outputs logs to the console if the log level is specified or if running in a development/test environment.
 */
if (process.env.LOG_LEVEL || !['production', 'test'].includes(process.env.NODE_ENV || 'development')) {
    logger.add(
        new winston.transports.Console({
            format: combine(
                colorize(),
                align(),
                printf(({ level, message, timestamp, stack }) => {
                    return `${timestamp} [${level}]: ${stack || message}`;
                }),
            ),
            level: logLevel,
        }),
    );
}

export default logger;
