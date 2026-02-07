import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

const backupDir = 'backups';
const dbFile = 'database.sqlite';

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const date = new Date();
const timestamp = date.toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `database-${timestamp}.sqlite`);

try {
    fs.copyFileSync(dbFile, backupFile);
    logger.info(`Database backed up successfully to ${backupFile}`);
} catch (error) {
    logger.error('Backup failed:', error);
    process.exit(1);
}
