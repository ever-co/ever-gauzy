import { generateEncryptionKey } from '@gauzy/utils';
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Default Encryption Algorithm
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

@Injectable()
export class EncryptionService {
    private readonly algorithm = ENCRYPTION_ALGORITHM;
    private readonly key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');

    constructor() {
        if (!process.env.ENCRYPTION_KEY) {
            console.warn('ENCRYPTION_KEY is not set. Generating a temporary key for this session. This is not secure for production!');

            // Generate a random key for this session
            this.key = Buffer.from(generateEncryptionKey(32), 'base64');
        }
    }

    /**
     * Encrypts a plaintext string using AES-256-GCM encryption.
     *
     * This function generates a random initialization vector (IV) and uses it
     * along with the predefined encryption algorithm and key to securely encrypt
     * the given plaintext. The resulting ciphertext is combined with the IV and
     * the authentication tag to ensure integrity and confidentiality.
     *
     * @param {string} text - The plaintext string to encrypt.
     * @returns {string} The encrypted data in the format: `{IV}:{AuthTag}:{EncryptedText}`.
     *
     * @example
     * const encrypted = encryptionService.encrypt('Sensitive Data');
     * console.log(encrypted); // Outputs encrypted string with IV and AuthTag
     */
    encrypt(text: string): string {
        const iv = randomBytes(16); // Generate a random initialization vector
        const cipher = createCipheriv(this.algorithm, this.key, iv); // Create cipher instance

        let encrypted = cipher.update(text, 'utf8', 'hex'); // Encrypt the plaintext
        encrypted += cipher.final('hex'); // Finalize encryption

        const authTag = cipher.getAuthTag(); // Get the authentication tag

        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`; // Return combined encrypted result
    }

    /**
     * Decrypts an encrypted string back into plaintext.
     *
     * This function reverses the encryption process by extracting the initialization vector (IV),
     * authentication tag, and the ciphertext from the input string. It uses the AES-256-GCM
     * algorithm and the predefined encryption key to securely decrypt the data. The authentication
     * tag ensures the integrity of the encrypted data.
     *
     * @param {string} text - The encrypted string to decrypt in the format: `{IV}:{AuthTag}:{EncryptedText}`.
     * @returns {string} The decrypted plaintext string.
     *
     * @throws {Error} If decryption fails due to incorrect data or tampering.
     *
     * @example
     * const decrypted = encryptionService.decrypt('ivHex:authTagHex:encryptedText');
     * console.log(decrypted); // Outputs the original plaintext
     */
    decrypt(text: string): string {
        const [ivHex, authTagHex, encryptedText] = text.split(':'); // Split encrypted data into components

        const iv = Buffer.from(ivHex, 'hex'); // Convert IV from hex to buffer
        const authTag = Buffer.from(authTagHex, 'hex'); // Convert auth tag from hex to buffer

        const decipher = createDecipheriv(this.algorithm, this.key, iv); // Create decipher instance
        decipher.setAuthTag(authTag); // Set the authentication tag for integrity verification

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8'); // Decrypt the ciphertext
        decrypted += decipher.final('utf8'); // Finalize decryption

        return decrypted; // Return the plaintext result
    }
}
