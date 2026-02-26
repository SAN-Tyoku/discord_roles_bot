import fs from 'fs';
import path from 'path';
import logger from './logger';

const localesPath = path.join(process.cwd(), 'locales');
const DEFAULT_LOCALE = 'en-US';

class I18n {
    private locales: Record<string, any> = {};

    constructor() {
        this.loadLocales();
    }

    private loadLocales() {
        if (!fs.existsSync(localesPath)) {
            logger.warn(`Locales directory not found at ${localesPath}`);
            return;
        }

        const files = fs.readdirSync(localesPath).filter((f) => f.endsWith('.json'));
        for (const file of files) {
            const locale = path.basename(file, '.json');
            try {
                const content = fs.readFileSync(path.join(localesPath, file), 'utf-8');
                this.locales[locale] = JSON.parse(content);
                logger.info(`Loaded locale: ${locale}`);
            } catch (error) {
                logger.error(`Failed to load locale ${locale}:`, error);
            }
        }
    }

    private localeMap: Record<string, string> = {
        ja: 'ja-JP',
        en: 'en-US',
        // Add more mappings if needed
    };

    /**
     * Get a localized string.
     * @param key Dot-separated key (e.g., "runtime.common.error")
     * @param args Arguments to replace in the string (e.g., { user: "Tag" })
     * @param locale Optional locale code (e.g., "ja", "en-US", "en-GB")
     * @returns The localized string
     */
    public t(key: string, args?: Record<string, string | number>, locale?: string): string {
        let targetLocale = DEFAULT_LOCALE;

        if (locale) {
            // Check direct match
            if (this.locales[locale]) {
                targetLocale = locale;
            } else {
                // Check mapping (e.g. ja -> ja-JP)
                const mapped = this.localeMap[locale];
                if (mapped && this.locales[mapped]) {
                    targetLocale = mapped;
                }
            }
        }
        // If no locale provided or no match found, targetLocale remains DEFAULT_LOCALE (en-US)

        // Try target locale
        let template = this.getNestedValue(this.locales[targetLocale], key);

        // Fallback to default locale (en-US) if key not found in target
        if (!template && targetLocale !== DEFAULT_LOCALE) {
            template = this.getNestedValue(this.locales[DEFAULT_LOCALE], key);
        }

        // Return key if not found
        if (!template) {
            logger.warn(`Missing translation key: ${key} in ${targetLocale}`);
            return key;
        }

        if (typeof template !== 'string') {
            logger.warn(`Translation key is not a string: ${key}`);
            return key;
        }

        // Replace arguments
        if (args) {
            for (const [argKey, argValue] of Object.entries(args)) {
                template = template.replace(new RegExp(`{${argKey}}`, 'g'), String(argValue));
            }
        }

        return template;
    }

    private getNestedValue(obj: any, path: string): any {
        if (!obj) return undefined;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}

export const i18n = new I18n();
