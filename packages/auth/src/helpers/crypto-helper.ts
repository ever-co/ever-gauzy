import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { environment } from '@gauzy/config';

export class CryptoHelper {
	private static readonly DEFAULT_SALT_ROUNDS = environment.USER_PASSWORD_BCRYPT_SALT_ROUNDS; // Default salt rounds if not specified
	private static readonly KEY_LENGTH = 64; // Length of the derived key in bytes for the hash
	private static readonly MAX_SALT_LENGTH = 16; // Maximum allowable salt length
	private static readonly scryptAsync = promisify(scrypt); // Promisified scrypt function for async usage

	/**
	 * Ensures that the salt length is within an acceptable range.
	 * If rounds are specified outside the range, they will default to
	 * either 1 or 16 bytes based on the boundaries.
	 *
	 * @param rounds - Number of rounds intended for salt length.
	 * @returns Validated salt length in bytes.
	 */
	private static getSaltLength(rounds: number): number {
		return Math.max(1, Math.min(rounds, this.MAX_SALT_LENGTH));
	}

	/**
	 * Synchronously generates a salt string in hexadecimal format.
	 * Uses `randomBytes` to create a salt of a specified length derived from
	 * the provided `rounds` parameter, defaulting to `DEFAULT_SALT_ROUNDS`.
	 *
	 * @param rounds - Number of rounds to determine the salt length, default is 10.
	 * @returns Hexadecimal string representing the salt.
	 */
	static genSaltSync(rounds: number = this.DEFAULT_SALT_ROUNDS): string {
		const saltLength = this.getSaltLength(rounds);
		return randomBytes(saltLength).toString('hex');
	}

	/**
	 * Asynchronously hashes a given data string or buffer with a generated salt.
	 * It uses Node.js `scrypt` function to derive a cryptographic hash based on
	 * the specified `saltLength`. The resulting salt and derived hash are combined
	 * into a single string, separated by a specified `separator`, defaulting to '.'.
	 *
	 * @param data - The data to hash, typically a string or Buffer.
	 * @param saltLength - Optional length for the salt; defaults to `DEFAULT_SALT_ROUNDS`.
	 * @param separator - Separator for salt and hash, defaults to '.'.
	 * @returns A promise resolving to a formatted string in the format 'salt.separator.hash'.
	 */
	static async hash(
		data: string | Buffer,
		saltLength: number = this.DEFAULT_SALT_ROUNDS,
		separator: string = '.'
	): Promise<string> {
		const salt = this.genSaltSync(saltLength); // Generate salt synchronously
		const derivedHash = (await this.scryptAsync(data, salt, this.KEY_LENGTH)) as Buffer; // Derive hash asynchronously
		return `${salt}${separator}${derivedHash.toString('hex')}`; // Combine salt and hash for storage
	}

	/**
	 * Asynchronously compares data against a stored encrypted hash to verify a match.
	 * This method splits the encrypted hash into salt and derived hash, rehashes
	 * the provided data using the same salt, and performs a secure, timing-safe
	 * comparison to avoid timing attacks.
	 *
	 * @param data - The data to verify, typically a plaintext string or Buffer.
	 * @param encrypted - The previously stored hash in the format 'salt:hash'.
	 * @param separator - Optional separator used to split the salt and hash; defaults to '.'.
	 * @returns A promise resolving to `true` if the data matches the stored hash, `false` otherwise.
	 */
	static async compare(
		data: string | Buffer, // The input data to verify
		encrypted: string, // The stored encrypted hash to compare against
		separator: string = '.' // Optional separator; defaults to '.'
	): Promise<boolean> {
		const [salt, storedKey] = encrypted.split(separator); // Separate stored hash into salt and derived hash
		const buffer = Buffer.from(storedKey, 'hex'); // Convert derived hash to a buffer for secure comparison
		const derivedHash = (await this.scryptAsync(data, salt, this.KEY_LENGTH)) as Buffer; // Re-hash with the same salt
		return timingSafeEqual(derivedHash, buffer); // Secure comparison to avoid timing attacks
	}
}
