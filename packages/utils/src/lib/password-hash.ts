import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify<string | Buffer, Buffer, number, ScryptOptions, Buffer>(scrypt);

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLength: 64, saltLength: 16 };

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SCRYPT_PARAMS.saltLength);
	const { N, r, p, keyLength } = SCRYPT_PARAMS;
	const derivedKey = await scryptAsync(password, salt, keyLength, { N, r, p });
	return ['$scrypt', N, r, p, salt.toString('hex'), derivedKey.toString('hex')].join('$');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
	try {
		const parts = hashedPassword.split('$');
		if (parts.length !== 7 || parts[1] !== 'scrypt') return false;

		const [, , nStr, rStr, pStr, saltHex, hashHex] = parts;
		const N = parseInt(nStr, 10);
		const r = parseInt(rStr, 10);
		const p = parseInt(pStr, 10);

		if (isNaN(N) || isNaN(r) || isNaN(p) || N <= 0 || r <= 0 || p <= 0) return false;
		if (N > 1048576 || r > 64 || p > 64) return false;
		if ((N & (N - 1)) !== 0) return false;

		const salt = Buffer.from(saltHex, 'hex');
		const storedHash = Buffer.from(hashHex, 'hex');
		const derivedKey = await scryptAsync(password, salt, storedHash.length, { N, r, p });

		return timingSafeEqual(derivedKey, storedHash);
	} catch {
		return false;
	}
}
