import { randomBytes, pbkdf2Sync, pbkdf2, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { environment } from '@gauzy/config';

export class CryptoHelper {
	private static readonly DEFAULT_SALT_ROUNDS = environment.USER_PASSWORD_BCRYPT_SALT_ROUNDS; // Default salt rounds if not specified
	private static readonly KEY_LENGTH = 64; // Length of the derived key in bytes for the hash
	private static readonly MAX_SALT_LENGTH = 16; // Maximum allowable salt length
	private static readonly ITERATIONS = 100000; // Number of iterations for PBKDF2
	private static readonly DIGEST = 'sha256'; // Digest algorithm
	private static readonly pbkdf2Async = promisify(pbkdf2); // Promisified pbkdf2 for async usage

	/**
	 * Generates a salt synchronously.
	 *
	 * @param rounds - Number of rounds for salt length (default 10).
	 * @returns A hexadecimal string representing the salt.
	 */
	static genSaltSync(rounds: number = this.DEFAULT_SALT_ROUNDS): string {
		const saltLength = Math.max(1, Math.min(rounds, this.MAX_SALT_LENGTH));
		return randomBytes(saltLength).toString('hex');
	}

	/**
	 * Asynchronously generates a salt.
	 *
	 * @param rounds - Number of rounds for salt length (default 10).
	 * @returns A promise that resolves to a hexadecimal salt string.
	 */
	static async genSalt(rounds: number = this.DEFAULT_SALT_ROUNDS): Promise<string> {
		const saltLength = Math.max(1, Math.min(rounds, this.MAX_SALT_LENGTH));
		return randomBytes(saltLength).toString('hex');
	}

	/**
	 * Synchronously hashes a given data string or buffer with a provided salt.
	 *
	 * @param data - The data to hash, typically a string or Buffer.
	 * @param salt - The salt to use when hashing.
	 * @returns The derived hash as a hexadecimal string.
	 */
	static hashSync(data: string | Buffer, salt: string): string {
		if (!data || !salt) {
			throw new Error('data and salt arguments are required');
		}

		const derivedHash = pbkdf2Sync(data, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST);
		return `${salt}.${derivedHash.toString('hex')}`;
	}

	/**
	 * Asynchronously hashes a given data string or buffer with a provided salt.
	 *
	 * @param data - The data to hash, typically a string or Buffer.
	 * @param salt - The salt to use when hashing.
	 * @returns A promise that resolves to a formatted string in the format 'salt.hash'.
	 */
	static async hash(data: string | Buffer, salt?: string): Promise<string> {
		if (!data) {
			throw new Error('data argument is required');
		}

		// Generate a random salt if none is provided
		salt = salt || (await this.genSalt());

		const derivedHash = await this.pbkdf2Async(data, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST);
		return `${salt}.${derivedHash.toString('hex')}`;
	}

	/**
	 * Synchronously compares raw data to a hash.
	 *
	 * @param data - The data to hash and compare.
	 * @param encrypted - The stored hash in the format 'salt.hash'.
	 * @returns `true` if hashed data matches the stored hash, `false` otherwise.
	 */
	static compareSync(data: string | Buffer, encrypted: string, separator: string = '.'): boolean {
		if (!data || !encrypted) {
			throw new Error('data and encrypted arguments are required');
		}

		const [salt, storedHash] = encrypted.split(separator);
		const derivedHash = pbkdf2Sync(data, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST);
		const buffer = Buffer.from(storedHash, 'hex');

		return timingSafeEqual(buffer, derivedHash);
	}

	/**
	 * Asynchronously compares raw data to a hash.
	 *
	 * @param data - The data to hash and compare.
	 * @param encrypted - The stored hash in the format 'salt.hash'.
	 * @returns A promise that resolves to `true` if the data matches the stored hash, `false` otherwise.
	 */
	static async compare(data: string | Buffer, encrypted: string, separator: string = '.'): Promise<boolean> {
		if (!data || !encrypted) {
			throw new Error('data and encrypted arguments are required');
		}

		const [salt, storedHash] = encrypted.split(separator);
		const derivedHash = await this.pbkdf2Async(data, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST);
		const buffer = Buffer.from(storedHash, 'hex');

		return timingSafeEqual(buffer, derivedHash);
	}

	/**
	 * Extracts the number of rounds used to generate the salt.
	 *
	 * @param hash - The stored hash string in the format 'salt.hash'.
	 * @returns The number of rounds based on the salt length.
	 */
	static getRounds(hash: string, separator: string = '.'): number {
		if (!hash) {
			throw new Error('hash argument is required');
		}

		const [salt] = hash.split(separator);
		return salt.length / 2; // Assuming hex-encoded salt, the rounds relate to its length
	}
}
