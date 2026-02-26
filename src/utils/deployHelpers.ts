import fs from 'fs';
import path from 'path';

const localesPath = path.join(process.cwd(), 'locales');

// Locale definitions to load (add more if needed)
const LOCALE_CODES: Record<string, string> = {
    ja: 'ja-JP',
    // 'en-US' is treated as default, so it doesn't strictly need to be here, but logic explicitly excludes it
};

/**
 * Synchronously loads JSON files from the locales directory.
 * @returns {Record<string, any>} Keys are locale codes (en-US, ja-JP), values are JSON content
 */
export function loadLocales(): Record<string, any> {
    const files = fs.readdirSync(localesPath).filter((f) => f.endsWith('.json'));
    const data: Record<string, any> = {};

    for (const file of files) {
        const locale = path.basename(file, '.json');
        const content = fs.readFileSync(path.join(localesPath, file), 'utf-8');
        try {
            data[locale] = JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
        }
    }
    return data;
}

const loadedLocales = loadLocales();
const defaultLocale = 'en-US';

/**
 * Helper to get values from deep within an object
 */
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Applies name and description localization to a Builder.
 * @param builder SlashCommandBuilder, SubcommandBuilder, OptionBuilder, etc.
 * @param keyPath Path to the key in locales JSON (e.g., "commands.auth.subcommands.setup")
 */
export function applyLocales(
    builder: any, // Any allowed for flexibility, or could use Union types
    keyPath: string,
) {
    // 1. Set default language (en-US)
    const defaultData = getNestedValue(loadedLocales[defaultLocale], keyPath);
    if (defaultData) {
        if (defaultData.name) builder.setName(defaultData.name);
        if (defaultData.description) builder.setDescription(defaultData.description);
    } else {
        console.warn(`[Missing Default Locale] Key: ${keyPath} in ${defaultLocale}`);
    }

    // 2. Set other language localizations
    const nameLocalizations: Record<string, string> = {};
    const descriptionLocalizations: Record<string, string> = {};

    for (const [code, localeKey] of Object.entries(LOCALE_CODES)) {
        // Look up ja -> ja-JP.json
        const localeData = loadedLocales[localeKey];
        if (!localeData) continue;

        const data = getNestedValue(localeData, keyPath);
        if (data) {
            if (data.name) nameLocalizations[code] = data.name;
            if (data.description) descriptionLocalizations[code] = data.description;
        }
    }

    if (Object.keys(nameLocalizations).length > 0) {
        builder.setNameLocalizations(nameLocalizations);
    }
    if (Object.keys(descriptionLocalizations).length > 0) {
        builder.setDescriptionLocalizations(descriptionLocalizations);
    }

    return builder;
}

/**
 * Applies localization to Choices
 */
export function applyChoiceLocales(
    choices: { name: string; value: string }[],
    keyPath: string, // e.g., "commands.manage_role.options.action.choices"
) {
    return choices.map((choice) => {
        const choiceKey = choice.value; // "add", "remove", etc.
        const nameLocalizations: Record<string, string> = {};

        // Default name (en-US)
        const defaultChoiceName = getNestedValue(loadedLocales[defaultLocale], `${keyPath}.${choiceKey}`);
        const name = defaultChoiceName || choice.name;

        // Localize
        for (const [code, localeKey] of Object.entries(LOCALE_CODES)) {
            const val = getNestedValue(loadedLocales[localeKey], `${keyPath}.${choiceKey}`);
            if (val) {
                nameLocalizations[code] = val;
            }
        }

        return {
            name,
            value: choice.value,
            nameLocalizations,
        };
    });
}
