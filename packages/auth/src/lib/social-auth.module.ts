import { DynamicModule, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@gauzy/config';
import { AuthGuards, Controllers, Strategies } from './internal';
import { SocialAuthService } from './social-auth.service';

@Module({
	imports: [
		ConfigModule,
		HttpModule
	],
	controllers: [...Controllers],
	providers: [...Strategies, ...AuthGuards, SocialAuthService],
	exports: [SocialAuthService]
})
export class SocialAuthModule {
	/**
	 * Registers the SocialAuthModule asynchronously.
	 *
	 * @param options - The options used to configure the SocialAuthModule.
	 * @returns {DynamicModule} - A dynamically created module with configured providers and imports.
	 */
	public static registerAsync(options: any): DynamicModule {
		return {
			module: SocialAuthModule,
			providers: [...SocialAuthModule.createConnectProviders(options)],
			imports: [...options.imports],
			exports: [...options.imports]
		} as DynamicModule;
	}

	/**
	 * Creates an array of providers for connecting and configuring the SocialAuthService.
	 *
	 * @param options - The options used to specify the provider configuration.
	 * @returns {Provider[]} - An array of providers to be registered in the module.
	 */
	private static createConnectProviders(options: any): Provider[] {
		return [
			{
				provide: SocialAuthService,
				useClass: options.useClass
			}
		];
	}
}
