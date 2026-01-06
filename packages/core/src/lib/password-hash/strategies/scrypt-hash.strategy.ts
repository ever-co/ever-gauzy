import { Injectable } from '@nestjs/common';
import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'crypto';
import { promisify } from 'util';
import { IPasswordHashStrategy } from '../interfaces';

const scryptAsync = promisify<string | Buffer, Buffer, number, ScryptOptions, Buffer>(scrypt);

/**
 * Scrypt password hashing strategy using Node.js native crypto module.
 * Hash format: $scrypt$N$r$p$salt$hash
 */
@Injectable()
export class ScryptHashStrategy implements IPasswordHashStrategy {
	private readonly ALGORITHM_PREFIX = '$scrypt$';
	private readonly SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLength: 64, saltLength: 16 };

	async hash(password: string): Promise<string> {
		const salt = randomBytes(this.SCRYPT_PARAMS.saltLength);
		const { N, r, p, keyLength } = this.SCRYPT_PARAMS;
		const derivedKey = await scryptAsync(password, salt, keyLength, { N, r, p });
		return ['$scrypt', N, r, p, salt.toString('hex'), derivedKey.toString('hex')].join('$');
	}

	async verify(password: string, hashedPassword: string): Promise<boolean> {
		try {
			const parts = hashedPassword.split('$');
			if (parts.length !== 7 || parts[1] !== 'scrypt') return false;

			const [, , nStr, rStr, pStr, saltHex, hashHex] = parts;
			const N = parseInt(nStr, 10);
			const r = parseInt(rStr, 10);
			const p = parseInt(pStr, 10);
			const salt = Buffer.from(saltHex, 'hex');
			const storedHash = Buffer.from(hashHex, 'hex');
			const derivedKey = await scryptAsync(password, salt, storedHash.length, { N, r, p });

			return timingSafeEqual(derivedKey, storedHash);
		} catch {
			return false;
		}
	}

	getAlgorithmIdentifier(): string {
		return 'scrypt';
	}

	canVerify(hashedPassword: string): boolean {
		return hashedPassword?.startsWith(this.ALGORITHM_PREFIX) ?? false;
	}
}
