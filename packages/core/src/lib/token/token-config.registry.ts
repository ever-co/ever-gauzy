import { Injectable, NotFoundException } from '@nestjs/common';
import { IJwtService } from './interfaces/jwt-service.interface';
import { ITokenConfig } from './interfaces';

@Injectable()
export class TokenConfigRegistry {
	private readonly configs: Map<string, ITokenConfig> = new Map();
	private readonly jwtServices: Map<string, IJwtService> = new Map();

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
	 * Register JWT service for a token type
	 */
	registerJwtService(tokenType: string, jwtService: IJwtService): void {
		if (this.jwtServices.has(tokenType)) {
			throw new Error(`JWT service for token type ${tokenType} is already registered`);
		}

		this.jwtServices.set(tokenType, jwtService);
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
	 * Get JWT service for a token type
	 */
	getJwtService(tokenType: string): IJwtService {
		const jwtService = this.jwtServices.get(tokenType);

		if (!jwtService) {
			throw new NotFoundException(`JWT service for token type ${tokenType} is not registered`);
		}

		return jwtService;
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
		this.jwtServices.delete(tokenType);
	}
}
