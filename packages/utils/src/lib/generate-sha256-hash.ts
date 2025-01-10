import { createHash } from 'crypto';

/**
 * Generate a SHA256 hash of the input string.
 *
 * @param data - The input string to hash.
 * @returns The SHA256 hash of the input string as a hexadecimal string.
 */
export function generateSha256Hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

// Example usage (for testing purposes, can be removed in production)
// const secretKey = 'my-secret-key';
// console.log('SHA256 Hash:', generateSha256Hash(secretKey));
