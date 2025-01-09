import { randomBytes } from 'crypto';

/**
 * Generates a secure 32-byte encryption key encoded in Base64.
 *
 * @returns {string} A Base64-encoded encryption key.
 *
 * @example
 * const encryptionKey = generateEncryptionKey();
 * console.log(encryptionKey); // Outputs a 32-byte Base64-encoded string
 */
export function generateEncryptionKey(length: number = 32): string {
    return randomBytes(length).toString('base64');
}
