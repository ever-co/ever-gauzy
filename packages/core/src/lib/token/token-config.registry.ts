import { Injectable, NotFoundException } from '@nestjs/common';
import { ITokenConfig } from './interfaces';

@Injectable()
export class TokenConfigRegistry {
	private readonly configs: Map<string, ITokenConfig> = new Map();

	/**
	 * Register a new token type configuration
	 */
	register(config: ITokenConfig): void {
		if (this.configs.has(config.tokenType)) {
			throw new Error(`Token type ${config.tokenType} is already registered`);
		}

		this.configs.set(config.tokenType, config);
	}

	/**
	 * Get configuration for a token type
	 */
	getConfig(tokenType: string): ITokenConfig {
		const config = this.configs.get(tokenType);

		if (!config) {
			throw new NotFoundException(`Token type ${tokenType} is not registered`);
		}

		return config;
	}

	/**
	 * Check if a token type is registered
	 */
	hasConfig(tokenType: string): boolean {
		return this.configs.has(tokenType);
	}

	/**
	 * Get all registered token types
	 */
	getRegisteredTypes(): string[] {
		return Array.from(this.configs.keys());
	}

	/**
	 * Unregister a token type (for testing or dynamic configurations)
	 */
	unregister(tokenType: string): void {
		this.configs.delete(tokenType);
	}
}
