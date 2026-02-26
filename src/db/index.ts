import * as sqlite3 from 'sqlite3';

const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : 'database.sqlite';
const db = new sqlite3.Database(dbPath);

/**
 * Interface representing guild-specific configuration
 */
export interface GuildConfig {
    guild_id: string;
    notification_channel_id: string | null;
    panel_channel_id: string | null;
    panel_message_id: string | null;
    auth_panel_message: string;
    /** JSON string format */
    modal_questions: string;
    /** 0: disabled, 1: enabled */
    dm_notification_enabled: number;
}

/**
 * Interface representing authentication application information
 */
export interface AuthApplication {
    id: number;
    user_id: string;
    guild_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
    /** JSON string format */
    answers: string;
    applied_at: number;
    processed_at: number | null;
    processor_id: string | null;
    notes: string | null;
    notification_message_id: string | null;
}

/**
 * Interface representing blacklist entry
 */
export interface BlacklistEntry {
    user_id: string;
    guild_id: string;
    reason: string | null;
    added_at: number;
    added_by: string;
}

/**
 * Creates and initializes database tables.
 * Creates tables if they do not exist.
 * @returns {Promise<void>} Promise resolved when initialization is complete
 */
export const initDb = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `CREATE TABLE IF NOT EXISTS GuildConfig (
                guild_id TEXT PRIMARY KEY,
                notification_channel_id TEXT,
                panel_channel_id TEXT,
                panel_message_id TEXT,
                auth_panel_message TEXT NOT NULL DEFAULT 'Click below to apply for authentication.',
                modal_questions TEXT NOT NULL DEFAULT '[]',
                dm_notification_enabled INTEGER NOT NULL DEFAULT 0
            )`,
                (err: Error | null) => {
                    if (err) reject(err);
                },
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS AuthApplications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                status TEXT NOT NULL,
                answers TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                processed_at INTEGER,
                processor_id TEXT,
                notes TEXT,
                notification_message_id TEXT
            )`,
                (err: Error | null) => {
                    if (err) reject(err);
                    else {
                        // Migration for adding columns (for existing DB)
                        // Ignore errors (e.g., column already exists)
                        db.run(`ALTER TABLE AuthApplications ADD COLUMN notification_message_id TEXT`, () => {
                            // Continue regardless of success or failure
                        });
                    }
                },
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS Blacklist (
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                reason TEXT,
                added_at INTEGER NOT NULL,
                added_by TEXT NOT NULL,
                PRIMARY KEY (user_id, guild_id)
            )`,
                (err: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                },
            );
        });
    });
};

/**
 * Executes an SQL query (INSERT, UPDATE, DELETE, etc.).
 * @param {string} sql SQL query to execute
 * @param {Array<string | number | boolean | null | undefined>} params SQL parameters
 * @returns {Promise<void>} Promise resolved when query execution is complete
 */
export const dbRun = (sql: string, params: (string | number | boolean | null | undefined)[] = []): Promise<void> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err: Error | null) {
            if (err) reject(err);
            else resolve();
        });
    });
};

/**
 * Executes an SQL query to retrieve a single result (SELECT, etc.).
 * @template T Expected result type
 * @param {string} sql SQL query to execute
 * @param {Array<string | number | boolean | null | undefined>} params SQL parameters
 * @returns {Promise<T | undefined>} Result row object, or undefined if not found
 */
export const dbGet = <T>(
    sql: string,
    params: (string | number | boolean | null | undefined)[] = [],
): Promise<T | undefined> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err: Error | null, row: unknown) => {
            if (err) reject(err);
            else resolve(row as T);
        });
    });
};

/**
 * Executes an SQL query to retrieve multiple results (SELECT, etc.).
 * @template T Expected result row type
 * @param {string} sql SQL query to execute
 * @param {Array<string | number | boolean | null | undefined>} params SQL parameters
 * @returns {Promise<T[]>} Array of result row objects
 */
export const dbAll = <T>(sql: string, params: (string | number | boolean | null | undefined)[] = []): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: unknown[]) => {
            if (err) reject(err);
            else resolve(rows as T[]);
        });
    });
};

export default db;
