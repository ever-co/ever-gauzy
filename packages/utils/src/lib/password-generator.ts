import { generate, GenerateOptions} from 'generate-password';

/**
 * Generates a secure random password with the specified length and options.
 *
 * This function uses default settings for generating a strong password with numbers,
 * uppercase letters, and optional customizations passed through `options`.
 *
 * @param {number} length - The length of the password to be generated. Defaults to 32 characters.
 * @param {GenerateOptions} [options] - Optional customization options for password generation.
 * @returns {string} The generated password as a string.
 *
 * @example
 * // Generate a password with default settings
 * const password = generatePassword();
 * console.log(password); // Outputs a 32-character random password
 *
 * @example
 * // Generate a 16-character password with symbols
 * const passwordWithSymbols = generatePassword(16, { symbols: true });
 * console.log(passwordWithSymbols); // Outputs a 16-character password with symbols
 */
export function generatePassword(length: number = 32, options?: GenerateOptions): string {
    return generate({
        length,
        numbers: true,
        symbols: false,
        uppercase: true,
        strict: true,
        ...options,
    });
}
