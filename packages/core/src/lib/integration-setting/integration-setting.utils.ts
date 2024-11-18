import { isNotEmpty, isObject } from "@gauzy/common";

// Assuming you have fetched sensitive keys specific entity
export const sensitiveSecretKeys = ['apiKey', 'apiSecret', 'openAiSecretKey', 'openAiOrganizationId'];

/**
 * Wrap specified keys in an object with a specific character.
 *
 * @param keysToWrap - An array of keys to be wrapped.
 * @param secrets - The object containing the sensitive data.
 * @param percentage - The percentage of the string to be replaced with the character.
 * @param character - The character used for replacement.
 * @returns The object with specified keys wrapped.
 */
export function keysToWrapSecrets(
    keysToWrap: string[],
    secrets: Record<string, any>,
    percentage = 35,
    character = '*'
) {
    // Checks if a value is an object
    if (isObject(secrets) && Array.isArray(keysToWrap)) {
        // Checks if a value is not empty
        for (const key of keysToWrap) {
            if (isNotEmpty(secrets[key])) {
                const string = secrets[key].toString();
                // Calculate offset in percentage based on secret length
                const offset = Math.ceil((percentage / 100) * string.length);

                // Get first offset character
                const first = string.substring(0, offset);

                // Get last offset character
                const last = string.slice(string.length - offset);

                // Create character repeater
                const repeater = character.repeat(offset);

                // ReplaceAll secrets with character
                secrets[key] = string.replace(first, repeater).replace(last, repeater);
            }
        }
    }
    return secrets;
}
