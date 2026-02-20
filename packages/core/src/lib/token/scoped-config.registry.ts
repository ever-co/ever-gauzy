import { Injectable } from '@nestjs/common';
import { ITokenConfig } from './interfaces';
/**
 * Scoped Token Configuration
 * Provides access to a specific token type's configuration
 * Used for dependency injection with specific token types
 */
@Injectable()
export class ScopedTokenConfig {
	constructor(private readonly config: ITokenConfig) {}

	/**
	 * Get the token type this config is scoped to
	 */
	get tokenType(): string {
		return this.config.tokenType;
	}

	/**
	 * Get the full configuration
	 */
	get configuration(): ITokenConfig {
		return this.config;
	}

	/**
	 * Get expiration in milliseconds
	 */
	get expirationMs(): number | undefined {
		return this.config.expiration;
	}

	/**
	 * Get inactivity threshold in milliseconds
	 */
	get threshold(): number | undefined {
		return this.config.threshold;
	}

	/**
	 * Check if rotation is allowed
	 */
	get allowRotation(): boolean {
		return this.config.allowRotation;
	}

	/**
	 * Check if multiple sessions are allowed
	 */
	get allowMultipleSessions(): boolean {
		return this.config.allowMultipleSessions;
	}

	/**
	 * Get max usage count
	 */
	get maxUsageCount(): number | undefined {
		return this.config.maxUsageCount;
	}
}
