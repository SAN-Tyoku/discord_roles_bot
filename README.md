# Discord Role Application Bot

A Discord bot for managing authentication applications and automatic role assignment. It allows users to submit applications, and administrators to approve or reject them, with automatic role granting upon approval.

## Table of Contents

*   [Key Features](#key-features)
*   [Setup](#setup)
*   [Environment Variables](#environment-variables)
*   [Required Discord Gateway Intents](#required-discord-gateway-intents)
*   [Required Bot Permissions](#required-bot-permissions)
*   [How to Run](#how-to-run)
    *   [Build & Start (Production)](#build--start-production)
    *   [Development Mode](#development-mode)
*   [Commands](#commands)
    *   [/auth (Admin/Processor)](#auth-adminprocessor)
    *   [/manage_role (Admin)](#manage_role-admin)
*   [Logs](#logs)
*   [Disclaimer](#disclaimer)
*   [License](#license)
*   [Japanese Documentation](docs/README_ja.md)

## Key Features

*   **Auth Panel Creation**: Place a panel with an "Apply" button in a channel.
*   **Modal Input**: Display a questionnaire (max 5 questions) to users upon application.
*   **Approval Flow**: Applications are sent to a notification channel where admins can "Approve (Grant Role)" or "Reject (with Reason)".
*   **Role Management**: Select roles to grant from a menu upon approval (multiple roles supported).
*   **Permission Checks**: Secure design prevents operation on roles higher than the Bot or the acting user.
*   **History Management**: View past application history (Approved/Rejected/Cancelled) per user.
*   **Blacklist**: Block applications from specific users.
*   **Application Cancellation**: Users can withdraw their own applications via a button on the panel.
*   **DM Notification**: Automatically notify users via DM when their application is approved.
*   **Dual Locale Support (i18n)**:
    *   **User Locale**: Ephemeral responses and error messages are displayed in the user's Discord client language.
    *   **Server Locale**: Auth panels, logs, and public messages are displayed in the server's configured language.
*   **Auto History Cleanup**: Automatically removes old records when a user's history exceeds 30 entries.

## Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/SAN-Tyoku/discord_roles_bot.git
    cd discord_roles_bot
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Register Slash Commands**:
    Register slash commands (`/auth`, etc.) to your Discord server. This must be run once before starting the bot.
    ```bash
    npm run deploy
    ```

4.  **Configure Environment Variables**:
    Create a `.env` file in the project root. Refer to `.env.example` and fill in the necessary information.
    ```bash
    cp .env.example .env
    ```

## Environment Variables

Set the following variables in your `.env` file.

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Discord Bot Token | `MTI3...` |
| `APPLICATION_ID` | Discord Application ID | `1234567890...` |
| `LOG_LEVEL` | Log Output Level | `info`, `debug`, `warn`, `error` |
| `NODE_ENV` | Execution Environment | `development` (with console output) / `production` (file output only) |

## Required Discord Gateway Intents

The bot uses the following Intents. Enabling "Privileged Gateway Intents" in the Discord Developer Portal is **not required** for basic functionality.

*   `Guilds` (Retrieve guild info)
*   `GuildMessages` (Operate on messages)

*Note: Determining member info is done via API calls, so `Server Members Intent` is not required.*

## Required Bot Permissions

Grant the following permissions to the Bot when inviting it or to its role:

1.  **Manage Roles**
    *   **Required** to grant roles to users upon approval.
    *   **Important**: Due to Discord limitations, the Bot can only grant roles *lower* than its own highest role. Ensure the Bot's role is placed above the roles it needs to assign in the Server Settings.
2.  **Send Messages**
    *   Required to place panels and send notifications.
3.  **Embed Links**
    *   Required for rich message displays (Embeds).
4.  **View Channel**
    *   Required to see the channels where panels are placed or notifications are sent.

## How to Run

### Build & Start (Production)
```bash
npm start
```
*   Compiles TypeScript (`npm run build`) and runs `dist/index.js`.
*   On first run, the database (`database.sqlite`) is automatically generated and slash commands are registered.

### Development Mode
```bash
npm run dev
```
*   Runs TypeScript files directly using `ts-node`.

### Code Quality Checks

ESLint and Prettier are configured to maintain code quality.

*   **Run Lint:**
    ```bash
    npm run lint
    ```
*   **Auto-format:**
    ```bash
    npm run format
    ```

## Commands

### `/auth` (Admin/Processor)
Main command for managing the authentication system.

*   **`help`**: Show initial setup guide and command list.
*   **`setup`**: Create and place the authentication panel.
*   **`channel`**: Set the "Notification Channel" where applications are sent (Required).
*   **`modal`**: Configure application questions (max 5). Prefix a question with `(*?)` to make it optional.
*   **`status`**: Display current settings, application counts, and system status.
*   **`config`**: Display current configuration (Notification target, Panel location, Questions).
*   **`history [user]`**: Display past application history for a specific user.
*   **`blacklist`**:
    *   `add [user] [reason]`: Add a user to the blacklist.
    *   `remove [user]`: Remove a user from the blacklist.
    *   `list`: specific user's blacklist entries.
*   **`dm_notification [enable]`**:
    *   Toggle DM notification on approval (`True`/`False`).

### `/manage_role` (Admin)
Helper command to manually grant/remove roles.

*   **`user`**: Target User
*   **`role`**: Target Role
*   **`action`**: `Grant` or `Remove`

## Logs

Bot logs are saved in the `logs/` directory.

*   **`logs/combined.log`**: All logs (Info, Warn, Error)
*   **`logs/error.log`**: Error logs only

If `NODE_ENV` is `development`, logs are also output to the console.

## Disclaimer

This bot was built by a student fueled by the "it works for me" spirit. 

* **Maintenance & Support**: While the code is written with care, I offer **zero guarantees** regarding long-term maintenance or support. I may fix issues if I have the time and energy, but no promises!
* **Use at Your Own Risk**: If things break or stop working, please understand that this is a personal project.
* **Contributions**: Since this is open-source, you are more than welcome to fork the repository, fix bugs, or customize it to fit your needs!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.