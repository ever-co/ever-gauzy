import { randomBytes } from 'crypto';

/**
 * Generates a UUID-like string without dashes using Node.js crypto.
 *
 * This function creates a UUID-like string that adheres to the standard UUID format
 * but without dashes. It uses cryptographically secure random bytes for generation.
 *
 * @returns {string} A UUID-like string without dashes.
 *
 * @example
 * const id = generateUuidWithoutDashesCrypto();
 * console.log(id); // Outputs a UUID-like string like "e48bfc3c1e724e7a931f501bc0036b45"
 */
export function generateUuidWithoutDashesCrypto(): string {
    const bytes = randomBytes(16);
    return (
        bytes.toString('hex').slice(0, 8) +
        bytes.toString('hex').slice(8, 12) +
        bytes.toString('hex').slice(12, 16) +
        bytes.toString('hex').slice(16, 20) +
        bytes.toString('hex').slice(20)
    );
}

/**
 * Generates a UUID-like string without dashes.
 *
 * @returns {string} A UUID-like string without dashes.
 */
export function generateUuidWithoutDashes(): string {
    return generateUuidWithoutDashesCrypto();
}
