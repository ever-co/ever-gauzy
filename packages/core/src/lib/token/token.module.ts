import { DynamicModule, FactoryProvider, Module, ModuleMetadata, Provider, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Token } from './entities/token.entity';

// Repositories
import { TokenRepository } from './repositories/token.repository';

// Services
import { ScopedJwtService } from './services/scoped-jwt.service';
import { TokenHasherService } from './services/token-hasher.service';
import { TokenService } from './services/token.service';
import { TokenCleanupScheduler } from './token-cleanup.scheduler';
import { TokenConfigModule } from './token-config.module';
import { TokenConfigRegistry } from './token-config.registry';

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
import { TokenHasher } from './shared/token-hasher';

type TokenProviderToken = string | symbol;
type AsyncInjectTokens = NonNullable<FactoryProvider['inject']>;
type ExportedProvider = TokenProviderToken | Type<unknown>;
type TokenConfigFactory = (...args: unknown[]) => Promise<ITokenConfig> | ITokenConfig;
type TokenSecretFactory = (...args: unknown[]) => Promise<string> | string;

const CommandHandlers: Type<unknown>[] = [
	CreateTokenHandler,
	RotateTokenHandler,
	RevokeTokenHandler,
	RevokeAllUserTokensHandler,
	CleanupExpiredTokensHandler,
	CleanupInactiveTokensHandler
];

const QueryHandlers: Type<unknown>[] = [
	ValidateTokenHandler,
	GetTokenByIdHandler,
	GetActiveTokensHandler,
	GetTokensHandler,
	GetTokenAuditTrailHandler
];

const BaseExports: ExportedProvider[] = [
	TokenService,
	TokenRepositoryToken,
	TokenReadRepositoryToken,
	TokenWriteRepositoryToken,
	TokenMaintenanceRepositoryToken,
	JwtServiceToken,
	TokenHasherService
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
	configToken?: TokenProviderToken;

	/**
	 * Injection token for the scoped JWT service
	 * Example: 'REFRESH_TOKEN_JWT_SERVICE'
	 * Default: {tokenType}_JWT_SERVICE
	 */
	jwtServiceToken?: string | symbol;
}

export interface TokenModuleFeatureAsyncOptions {
	imports?: ModuleMetadata['imports'];
	inject?: AsyncInjectTokens;
	useFactory: TokenConfigFactory;
	jwtSecret?: string | TokenSecretFactory;
	serviceToken?: TokenProviderToken;
	configToken?: TokenProviderToken;
	jwtServiceToken?: TokenProviderToken;
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
			TokenHasherService,
			{
				provide: TokenHasher,
				useExisting: TokenHasherService
			}
		];
	}

	private static buildFeatureImports(
		additionalImports: ModuleMetadata['imports'] = []
	): NonNullable<ModuleMetadata['imports']> {
		return [
			CqrsModule,
			TokenConfigModule,
			TypeOrmModule.forFeature([Token]),
			MikroOrmModule.forFeature([Token]),
			...(additionalImports ?? [])
		];
	}

	private static buildScopedConfigProvider(
		configToken: TokenProviderToken,
		configFactory: TokenConfigFactory,
		inject: AsyncInjectTokens = []
	): FactoryProvider<ScopedTokenConfig> {
		return {
			provide: configToken,
			useFactory: async (registry: TokenConfigRegistry, ...args: unknown[]): Promise<ScopedTokenConfig> => {
				const config = await configFactory(...args);
				registry.register(config);
				return new ScopedTokenConfig(config);
			},
			inject: [TokenConfigRegistry, ...inject]
		};
	}

	private static buildScopedJwtProviders(
		configToken: TokenProviderToken,
		jwtServiceToken: TokenProviderToken,
		jwtSecret?: string | TokenSecretFactory,
		inject: AsyncInjectTokens = []
	): Provider[] {
		if (!jwtSecret) {
			return [
				{
					provide: jwtServiceToken,
					useExisting: JwtService
				}
			];
		}

		if (typeof jwtSecret === 'string') {
			return [
				{
					provide: jwtServiceToken,
					useFactory: (scopedConfig: ScopedTokenConfig, jwtService: JwtService) => {
						return new ScopedJwtService(jwtSecret, scopedConfig.tokenType, jwtService);
					},
					inject: [configToken, JwtService]
				}
			];
		}

		const jwtSecretToken = Symbol('TOKEN_MODULE_JWT_SECRET');
		return [
			{
				provide: jwtSecretToken,
				useFactory: (...args: unknown[]) => jwtSecret(...args),
				inject
			},
			{
				provide: jwtServiceToken,
				useFactory: async (scopedConfig: ScopedTokenConfig, secret: string, jwtService: JwtService) => {
					return new ScopedJwtService(secret, scopedConfig.tokenType, jwtService);
				},
				inject: [configToken, jwtSecretToken, JwtService]
			}
		];
	}

	private static buildJwtRegistrationProvider(
		configToken: TokenProviderToken,
		jwtServiceToken: TokenProviderToken
	): FactoryProvider<boolean> {
		return {
			provide: Symbol('TOKEN_MODULE_JWT_REGISTRATION'),
			useFactory: (
				registry: TokenConfigRegistry,
				scopedConfig: ScopedTokenConfig,
				scopedJwtService: IJwtService
			) => {
				registry.registerJwtService(scopedConfig.tokenType, scopedJwtService);
				return true;
			},
			inject: [TokenConfigRegistry, configToken, jwtServiceToken]
		};
	}

	private static buildScopedProviders(
		configToken: TokenProviderToken,
		serviceToken: TokenProviderToken,
		jwtServiceToken: TokenProviderToken,
		configProvider: Provider,
		jwtProviders: Provider[]
	): Provider[] {
		return [
			configProvider,
			{
				provide: ScopedTokenConfig,
				useExisting: configToken
			},
			...jwtProviders,
			{
				provide: serviceToken,
				useClass: ScopedTokenService
			},
			this.buildJwtRegistrationProvider(configToken, jwtServiceToken)
		];
	}

	/**
	 * Register token module with options
	 */
	static forRoot(options: TokenModuleOptions = {}): DynamicModule {
		const { enableScheduler = true } = options;

		const providers: Provider[] = [...this.buildBaseProviders()];
		providers.push(...CommandHandlers, ...QueryHandlers);

		// Conditionally add scheduler
		if (enableScheduler) {
			providers.push(TokenCleanupScheduler);
		}

		return {
			module: TokenModule,
			imports: [
				ConfigModule,
				...this.buildFeatureImports(),
				...(enableScheduler ? [ScheduleModule.forRoot()] : [])
			],
			providers,
			exports: BaseExports
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
		const moduleExports: ExportedProvider[] = [...BaseExports];

		// If options provided, create scoped service with factory
		if (options?.config) {
			const {
				config,
				jwtSecret,
				serviceToken = `${config.tokenType}_SERVICE`,
				configToken = `${config.tokenType}_CONFIG`,
				jwtServiceToken = `${config.tokenType}_JWT_SERVICE`
			} = options;

			const configProvider = this.buildScopedConfigProvider(configToken, () => config);
			const jwtProviders = this.buildScopedJwtProviders(configToken, jwtServiceToken, jwtSecret);

			providers.push(
				...this.buildScopedProviders(configToken, serviceToken, jwtServiceToken, configProvider, jwtProviders)
			);

			// Export scoped tokens
			moduleExports.push(serviceToken, configToken, jwtServiceToken);
		}

		return {
			module: TokenModule,
			imports: this.buildFeatureImports(),
			providers,
			exports: moduleExports
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
		const moduleExports: ExportedProvider[] = [...BaseExports];
		const inject = options.inject ?? [];

		const configToken = options.configToken || `${options.useFactory.name.toUpperCase()}_CONFIG`;
		const serviceToken = options.serviceToken || `${options.useFactory.name.toUpperCase()}_SERVICE`;
		const jwtServiceToken = options.jwtServiceToken || `${options.useFactory.name.toUpperCase()}_JWT_SERVICE`;

		const configProvider = this.buildScopedConfigProvider(configToken, options.useFactory, inject);
		const jwtProviders = this.buildScopedJwtProviders(configToken, jwtServiceToken, options.jwtSecret, inject);

		providers.push(
			...this.buildScopedProviders(configToken, serviceToken, jwtServiceToken, configProvider, jwtProviders)
		);

		moduleExports.push(serviceToken, configToken, jwtServiceToken);

		return {
			module: TokenModule,
			imports: this.buildFeatureImports(options.imports),
			providers,
			exports: moduleExports
		};
	}
}
