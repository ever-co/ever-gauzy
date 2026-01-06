import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify<string | Buffer, Buffer, number, ScryptOptions, Buffer>(scrypt);

/**
 * Scrypt parameters for password hashing.
 * - N=16384 (2^14): CPU/memory cost. OWASP recommends N≥2^17 for high-security, but 2^14
 *   provides good balance of security and performance for most deployments.
 * - r=8: Block size. Standard value for scrypt.
 * - p=1: Parallelization. Keep at 1 for compatibility.
 *
 * Note: Changing these values will invalidate existing hashes and require a migration strategy.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLength: 64, saltLength: 16 };

/**
 * Hash a password using scrypt algorithm.
 * Format: $scrypt$N$r$p$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SCRYPT_PARAMS.saltLength);
	const { N, r, p, keyLength } = SCRYPT_PARAMS;
	const derivedKey = await scryptAsync(password, salt, keyLength, { N, r, p });
	return ['$scrypt', N, r, p, salt.toString('hex'), derivedKey.toString('hex')].join('$');
}

/**
 * Verify a password against a scrypt hash.
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
	try {
		const parts = hashedPassword.split('$');
		if (parts.length !== 7 || parts[1] !== 'scrypt') return false;

		const [, , nStr, rStr, pStr, saltHex, hashHex] = parts;
		const N = parseInt(nStr, 10);
		const r = parseInt(rStr, 10);
		const p = parseInt(pStr, 10);

		// Validate scrypt parameters to prevent DoS
		if (isNaN(N) || isNaN(r) || isNaN(p) || N <= 0 || r <= 0 || p <= 0) return false;
		if (N > 1048576 || r > 64 || p > 64) return false; // Prevent excessive CPU usage

		const salt = Buffer.from(saltHex, 'hex');
		const storedHash = Buffer.from(hashHex, 'hex');
		const derivedKey = await scryptAsync(password, salt, storedHash.length, { N, r, p });

		return timingSafeEqual(derivedKey, storedHash);
	} catch {
		return false;
	}
}
