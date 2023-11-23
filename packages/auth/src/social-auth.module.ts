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
	public static registerAsync(options: any): DynamicModule {
		return {
			module: SocialAuthModule,
			providers: [...SocialAuthModule.createConnectProviders(options)],
			imports: [...options.imports],
			exports: [...options.imports]
		} as DynamicModule;
	}

	private static createConnectProviders(options: any): Provider[] {
		return [
			{
				provide: SocialAuthService,
				useClass: options.useClass
			}
		];
	}
}
