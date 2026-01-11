import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@gauzy/config';
import { IPasswordHashStrategy } from '../interfaces';

/**
 * Bcrypt password hashing strategy (legacy, for backward compatibility).
 */
@Injectable()
export class BcryptHashStrategy implements IPasswordHashStrategy {
	private readonly BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];
	private readonly saltRounds: number;

	constructor() {
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS || 12;
	}

	async hash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	async verify(password: string, hashedPassword: string): Promise<boolean> {
		try {
			return await bcrypt.compare(password, hashedPassword);
		} catch {
			return false;
		}
	}

	getAlgorithmIdentifier(): string {
		return 'bcrypt';
	}

	canVerify(hashedPassword: string): boolean {
		return this.BCRYPT_PREFIXES.some((prefix) => hashedPassword?.startsWith(prefix));
	}
}
