import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPasswordHashStrategy, PASSWORD_HASH_STRATEGIES, DEFAULT_PASSWORD_HASH_STRATEGY } from './interfaces';

/**
 * Password hashing service that orchestrates multiple hashing strategies.
 * Supports transparent migration from legacy algorithms (bcrypt) to modern ones (scrypt).
 */
@Injectable()
export class PasswordHashService {
	private readonly logger = new Logger(PasswordHashService.name);

	constructor(
		@Inject(DEFAULT_PASSWORD_HASH_STRATEGY)
		private readonly defaultStrategy: IPasswordHashStrategy,
		@Inject(PASSWORD_HASH_STRATEGIES)
		private readonly strategies: IPasswordHashStrategy[]
	) {}

	async hash(password: string): Promise<string> {
		if (!password) throw new Error('Password must be a non-empty string');
		return this.defaultStrategy.hash(password);
	}

	async verify(password: string, hashedPassword: string): Promise<boolean> {
		if (!password || !hashedPassword) return false;
		const strategy = this.strategies.find((s) => s.canVerify(hashedPassword));
		if (!strategy) {
			this.logger.warn(`No strategy found for hash: ${hashedPassword.substring(0, 10)}...`);
			return false;
		}
		return strategy.verify(password, hashedPassword);
	}

	needsRehash(hashedPassword: string): boolean {
		return hashedPassword ? !this.defaultStrategy.canVerify(hashedPassword) : false;
	}

	getDefaultAlgorithm(): string {
		return this.defaultStrategy.getAlgorithmIdentifier();
	}
}
