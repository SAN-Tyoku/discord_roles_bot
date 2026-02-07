import { initDb, dbRun, dbGet, dbAll, GuildConfig, AuthApplication, BlacklistEntry } from './index';

// Explicitly set test environment (can be set in jest.config.js or npm script, but just in case)
process.env.NODE_ENV = 'test';

describe('Database Tests', () => {
    // Initialize DB before each test
    beforeAll(async () => {
        await initDb();
    });

    // Clear data after each test (if necessary)
    afterEach(async () => {
        await dbRun('DELETE FROM GuildConfig');
        await dbRun('DELETE FROM AuthApplications');
        await dbRun('DELETE FROM Blacklist');
    });

    test('should initialize database tables', async () => {
        // Check if tables exist (refer to sqlite_master table)
        const tables = await dbAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
        const tableNames = tables.map(t => t.name);
        expect(tableNames).toContain('GuildConfig');
        expect(tableNames).toContain('AuthApplications');
        expect(tableNames).toContain('Blacklist');
    });

    describe('GuildConfig', () => {
        test('should insert and retrieve guild config', async () => {
            const config: GuildConfig = {
                guild_id: '123456',
                notification_channel_id: '111',
                panel_channel_id: '222',
                panel_message_id: '333',
                auth_panel_message: 'Auth Here',
                modal_questions: '[]',
                dm_notification_enabled: 1
            };

            await dbRun(`INSERT INTO GuildConfig (
                guild_id, notification_channel_id, panel_channel_id, panel_message_id, auth_panel_message, modal_questions, dm_notification_enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                config.guild_id,
                config.notification_channel_id,
                config.panel_channel_id,
                config.panel_message_id,
                config.auth_panel_message,
                config.modal_questions,
                config.dm_notification_enabled
            ]);

            const result = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', ['123456']);
            expect(result).toBeDefined();
            expect(result?.guild_id).toBe('123456');
            expect(result?.auth_panel_message).toBe('Auth Here');
        });

        test('should update guild config', async () => {
            // Insert initial data
            await dbRun(`INSERT INTO GuildConfig (guild_id) VALUES (?)`, ['123']);

            // Update
            await dbRun(`UPDATE GuildConfig SET notification_channel_id = ? WHERE guild_id = ?`, ['999', '123']);

            const result = await dbGet<GuildConfig>('SELECT * FROM GuildConfig WHERE guild_id = ?', ['123']);
            expect(result?.notification_channel_id).toBe('999');
        });
    });

    describe('AuthApplications', () => {
        test('should insert and retrieve application', async () => {
            const app = {
                user_id: 'user1',
                guild_id: 'guild1',
                status: 'pending',
                answers: JSON.stringify(['Answer 1']),
                applied_at: Date.now()
            };

            await dbRun(`INSERT INTO AuthApplications (
                user_id, guild_id, status, answers, applied_at
            ) VALUES (?, ?, ?, ?, ?)`, [
                app.user_id,
                app.guild_id,
                app.status,
                app.answers,
                app.applied_at
            ]);

            const results = await dbAll<AuthApplication>('SELECT * FROM AuthApplications WHERE user_id = ?', ['user1']);
            expect(results.length).toBe(1);
            expect(results[0].status).toBe('pending');
            expect(JSON.parse(results[0].answers)).toEqual(['Answer 1']);
        });
    });

    describe('Blacklist', () => {
        test('should manage blacklist entries', async () => {
            const entry: BlacklistEntry = {
                user_id: 'bad_user',
                guild_id: 'guild1',
                reason: 'Spam',
                added_at: Date.now(),
                added_by: 'admin1'
            };

            await dbRun(`INSERT INTO Blacklist (
                user_id, guild_id, reason, added_at, added_by
            ) VALUES (?, ?, ?, ?, ?)`, [
                entry.user_id,
                entry.guild_id,
                entry.reason,
                entry.added_at,
                entry.added_by
            ]);

            const result = await dbGet<BlacklistEntry>('SELECT * FROM Blacklist WHERE user_id = ?', ['bad_user']);
            expect(result).toBeDefined();
            expect(result?.reason).toBe('Spam');

            // Delete test
            await dbRun('DELETE FROM Blacklist WHERE user_id = ?', ['bad_user']);
            const deleted = await dbGet('SELECT * FROM Blacklist WHERE user_id = ?', ['bad_user']);
            expect(deleted).toBeUndefined();
        });
    });
});
