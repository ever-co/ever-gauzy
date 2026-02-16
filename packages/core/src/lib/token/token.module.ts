import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Token } from './entities/token.entity';

// Repositories
import { TokenRepository } from './repositories/token.repository';

// Services
import { JwtService } from './services/jwt.service';
import { ScopedJwtService } from './services/scoped-jwt.service';
import { TokenService } from './services/token.service';
import { TokenConfigModule } from './token-config.module';
import { TokenConfigRegistry } from './token-config.registry';
import { TokenCleanupScheduler } from './token.scheduler';

// Command Handlers
import {
	CleanupExpiredTokensHandler,
	CleanupInactiveTokensHandler,
	CreateTokenHandler,
	RevokeAllUserTokensHandler,
	RevokeTokenHandler,
	RotateTokenHandler
} from './commands';

// Query Handlers
import {
	GetActiveTokensHandler,
	GetTokenAuditTrailHandler,
	GetTokenByIdHandler,
	GetTokensHandler,
	ValidateTokenHandler
} from './queries';

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IJwtService, ITokenConfig } from './interfaces';
import { MikroOrmTokenRepository, TypeOrmTokenRepository } from './repositories';
import { ScopedTokenConfig } from './scoped-config.registry';
import { ScopedTokenService } from './scoped-token.service';
import {
	JwtServiceToken,
	TokenMaintenanceRepositoryToken,
	TokenReadRepositoryToken,
	TokenRepositoryToken,
	TokenWriteRepositoryToken
} from './shared';

const CommandHandlers = [
	CreateTokenHandler,
	RotateTokenHandler,
	RevokeTokenHandler,
	RevokeAllUserTokensHandler,
	CleanupExpiredTokensHandler,
	CleanupInactiveTokensHandler
];

const QueryHandlers = [
	ValidateTokenHandler,
	GetTokenByIdHandler,
	GetActiveTokensHandler,
	GetTokensHandler,
	GetTokenAuditTrailHandler
];

export interface TokenModuleOptions {
	enableScheduler?: boolean;
}

export interface TokenModuleFeatureOptions {
	/**
	 * Token configuration for this feature module
	 */
	config: ITokenConfig;

	/**
	 * JWT secret for this token type
	 * If not provided, uses the global JWT_SECRET from environment
	 */
	jwtSecret?: string;

	/**
	 * Injection token for the scoped service
	 * Example: 'REFRESH_TOKEN_SERVICE'
	 * Default: {tokenType}_SERVICE
	 */
	serviceToken?: string | symbol;

	/**
	 * Injection token for the scoped config
	 * Example: 'REFRESH_TOKEN_CONFIG'
	 * Default: {tokenType}_CONFIG
	 */
	configToken?: string;

	/**
	 * Injection token for the scoped JWT service
	 * Example: 'REFRESH_TOKEN_JWT_SERVICE'
	 * Default: {tokenType}_JWT_SERVICE
	 */
	jwtServiceToken?: string | symbol;
}

export interface TokenModuleFeatureAsyncOptions {
	imports?: any[];
	inject?: any[];
	useFactory: (...args: any[]) => Promise<ITokenConfig> | ITokenConfig;
	jwtSecret?: string | ((...args: any[]) => Promise<string> | string);
	serviceToken?: string | symbol;
	configToken?: string;
	jwtServiceToken?: string | symbol;
}

@Module({})
export class TokenModule {
	private static buildBaseProviders(): Provider[] {
		return [
			TokenService,
			TokenRepository,
			TypeOrmTokenRepository,
			MikroOrmTokenRepository,
			{
				provide: TokenRepositoryToken,
				useExisting: TokenRepository
			},
			{
				provide: TokenReadRepositoryToken,
				useExisting: TokenRepository
			},
			{
				provide: TokenWriteRepositoryToken,
				useExisting: TokenRepository
			},
			{
				provide: TokenMaintenanceRepositoryToken,
				useExisting: TokenRepository
			},
			JwtService,
			{
				provide: JwtServiceToken,
				useExisting: JwtService
			},
		];
	}

	private static buildScopedProviders(
		configProviderToken: string,
		serviceProviderToken: string | symbol,
		jwtServiceProviderToken: string | symbol,
		configFactoryProvider: Provider,
		jwtServiceFactoryProvider?: Provider
	): Provider[] {
		const providers: Provider[] = [configFactoryProvider];

		// Add JWT service provider if custom one is provided
		if (jwtServiceFactoryProvider) {
			providers.push(jwtServiceFactoryProvider);
		} else {
			// Use global JWT service
			providers.push({
				provide: jwtServiceProviderToken,
				useExisting: JwtService
			});
		}

		// Add scoped token service
		providers.push({
			provide: serviceProviderToken,
			useFactory: (commandBus: CommandBus, queryBus: QueryBus, scopedConfig: ScopedTokenConfig) => {
				return new ScopedTokenService(commandBus, queryBus, scopedConfig);
			},
			inject: [CommandBus, QueryBus, configProviderToken]
		});

		// Add command and query handlers for the scoped service
		providers.push(...CommandHandlers, ...QueryHandlers);

		return providers;
	}

	/**
	 * Register token module with options
	 */
	static forRoot(options: TokenModuleOptions = {}): DynamicModule {
		const { enableScheduler = true } = options;

		const providers: Provider[] = [...this.buildBaseProviders()];

		// Conditionally add scheduler
		if (enableScheduler) {
			providers.push(TokenCleanupScheduler);
		}

		return {
			module: TokenModule,
			imports: [
				ConfigModule,
				CqrsModule,
				TokenConfigModule,
				TypeOrmModule.forFeature([Token]),
				MikroOrmModule.forFeature([Token]),
				...(enableScheduler ? [ScheduleModule.forRoot()] : [])
			],
			providers,
			exports: [
				TokenService,
				TokenRepositoryToken,
				TokenReadRepositoryToken,
				TokenWriteRepositoryToken,
				TokenMaintenanceRepositoryToken,
				JwtServiceToken
			]
		};
	}

	/**
	 * Register token module for feature modules with factory-based configuration
	 *
	 * @example Basic usage without configuration (old style)
	 * ```typescript
	 * @Module({
	 *   imports: [TokenModule.forFeature()],
	 * })
	 * export class MyModule {}
	 * ```
	 *
	 * @example With scoped configuration (new style - RECOMMENDED)
	 * ```typescript
	 * @Module({
	 *   imports: [
	 *     TokenModule.forFeature({
	 *       config: {
	 *         tokenType: 'REFRESH_TOKEN',
	 *         expirationMs: 30 * 24 * 60 * 60 * 1000,
	 *         allowRotation: true,
	 *         allowMultipleSessions: false,
	 *       },
	 *       jwtSecret: process.env.REFRESH_TOKEN_SECRET, // Custom JWT secret
	 *       serviceToken: 'REFRESH_TOKEN_SERVICE',
	 *       configToken: 'REFRESH_TOKEN_CONFIG',
	 *     }),
	 *   ],
	 * })
	 * export class RefreshTokenModule {}
	 * ```
	 */
	static forFeature(options?: TokenModuleFeatureOptions): DynamicModule {
		const providers: Provider[] = [...this.buildBaseProviders()];
		const exports: Array<string | symbol | Function> = [
			TokenService,
			TokenRepositoryToken,
			TokenReadRepositoryToken,
			TokenWriteRepositoryToken,
			TokenMaintenanceRepositoryToken,
			JwtServiceToken
		];

		// If options provided, create scoped service with factory
		if (options?.config) {
			const {
				config,
				jwtSecret,
				serviceToken = `${config.tokenType}_SERVICE`,
				configToken = `${config.tokenType}_CONFIG`,
				jwtServiceToken = `${config.tokenType}_JWT_SERVICE`
			} = options;

			// Create scoped JWT service if custom secret provided
			let jwtServiceFactoryProvider: Provider | undefined;
			if (jwtSecret) {
				jwtServiceFactoryProvider = {
					provide: jwtServiceToken,
					useFactory: () => {
						return new ScopedJwtService(jwtSecret, config.tokenType);
					}
				};
			}

			// Scoped Config - Factory with injection token
			const configFactoryProvider: Provider = {
				provide: configToken,
				useFactory: (registry: TokenConfigRegistry) => {
					registry.register(config);
					return new ScopedTokenConfig(config);
				},
				inject: [TokenConfigRegistry]
			};

			const jwtRegistrationProvider: Provider = {
				provide: `${configToken}_JWT_REGISTRATION`,
				useFactory: (registry: TokenConfigRegistry, scopedConfig: ScopedTokenConfig, scopedJwtService: IJwtService) => {
					registry.registerJwtService(scopedConfig.tokenType, scopedJwtService);
					return true;
				},
				inject: [TokenConfigRegistry, configToken, jwtServiceToken]
			};

			providers.push(
				...this.buildScopedProviders(
					configToken,
					serviceToken,
					jwtServiceToken,
					configFactoryProvider,
					jwtServiceFactoryProvider
				),
				jwtRegistrationProvider
			);

			// Export scoped tokens
			exports.push(serviceToken, configToken, jwtServiceToken);
		}

		return {
			module: TokenModule,
			imports: [
				CqrsModule,
				TokenConfigModule,
				TypeOrmModule.forFeature([Token]),
				MikroOrmModule.forFeature([Token])
			],
			providers,
			exports
		};
	}

	/**
	 * Register token module for feature modules with async configuration
	 *
	 * @example Async configuration with ConfigService
	 * ```typescript
	 * @Module({
	 *   imports: [
	 *     TokenModule.forFeatureAsync({
	 *       imports: [ConfigModule],
	 *       inject: [ConfigService],
	 *       useFactory: (configService: ConfigService) => ({
	 *         tokenType: 'REFRESH_TOKEN',
	 *         expirationMs: 30 * 24 * 60 * 60 * 1000,
	 *         allowRotation: true,
	 *         allowMultipleSessions: false,
	 *       }),
	 *       jwtSecret: (configService: ConfigService) =>
	 *         configService.get('REFRESH_TOKEN_SECRET'),
	 *       serviceToken: 'REFRESH_TOKEN_SERVICE',
	 *     }),
	 *   ],
	 * })
	 * export class RefreshTokenModule {}
	 * ```
	 */
	static forFeatureAsync(options: TokenModuleFeatureAsyncOptions): DynamicModule {
		const providers: Provider[] = [...this.buildBaseProviders()];
		const exports: Array<string | symbol | Function> = [
			TokenService,
			TokenRepositoryToken,
			TokenReadRepositoryToken,
			TokenWriteRepositoryToken,
			TokenMaintenanceRepositoryToken,
			JwtServiceToken
		];

		const configToken = options.configToken ?? 'TOKEN_CONFIG';
		const serviceToken = options.serviceToken ?? 'TOKEN_SERVICE';
		const jwtServiceToken = options.jwtServiceToken ?? 'TOKEN_JWT_SERVICE';

		// Create scoped JWT service if custom secret factory provided
		let jwtServiceFactoryProvider: Provider | undefined;
		if (options.jwtSecret) {
			jwtServiceFactoryProvider = {
				provide: jwtServiceToken,
				useFactory: async (...args: any[]) => {
					const config = await options.useFactory(...args);
					const secret =
						typeof options.jwtSecret === 'function' ? await options.jwtSecret(...args) : options.jwtSecret;
					return new ScopedJwtService(secret, config.tokenType);
				},
				inject: options.inject ?? []
			};
		}

		const configFactoryProvider: Provider = {
			provide: configToken,
			useFactory: async (registry: TokenConfigRegistry, ...args: any[]) => {
				const config = await options.useFactory(...args);
				registry.register(config);
				return new ScopedTokenConfig(config);
			},
			inject: [TokenConfigRegistry, ...(options.inject ?? [])]
		};

		const jwtRegistrationProvider: Provider = {
			provide: `${configToken}_JWT_REGISTRATION`,
			useFactory: (registry: TokenConfigRegistry, scopedConfig: ScopedTokenConfig, scopedJwtService: IJwtService) => {
				registry.registerJwtService(scopedConfig.tokenType, scopedJwtService);
				return true;
			},
			inject: [TokenConfigRegistry, configToken, jwtServiceToken]
		};

		providers.push(
			...this.buildScopedProviders(
				configToken,
				serviceToken,
				jwtServiceToken,
				configFactoryProvider,
				jwtServiceFactoryProvider
			),
			jwtRegistrationProvider
		);

		exports.push(serviceToken, configToken, jwtServiceToken);

		return {
			module: TokenModule,
			imports: [
				CqrsModule,
				TokenConfigModule,
				TypeOrmModule.forFeature([Token]),
				MikroOrmModule.forFeature([Token]),
				...(options.imports ?? [])
			],
			providers,
			exports
		};
	}
}
