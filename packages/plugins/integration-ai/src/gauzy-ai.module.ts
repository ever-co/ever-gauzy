import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { GauzyAIService } from './gauzy-ai.service';
import gauzyAI from './config/gauzy-ai';
import { ConfigurationOptions } from './configuration.interface';
import { RequestScopedConfigProvider } from './request-scoped-config.provider';

@Module({
	imports: [
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService) => ({
				baseURL: config.get<string>('guazyAI.gauzyAIRESTEndpoint'),
				timeout: config.get<number>('guazyAI.gauzyAIRequestTimeout'),
				maxRedirects: 5,
			}),
			inject: [ConfigService],
		}),
		ConfigModule.forFeature(gauzyAI),
	],
	controllers: [],
	providers: [
		ConfigService,
		GauzyAIService,
		RequestScopedConfigProvider
	],
	exports: [
		GauzyAIService,
		RequestScopedConfigProvider
	],
})
export class GauzyAIModule {
	/**
	 *
	 * @param options
	 * @returns
	 */
	static forRoot(options?: ConfigurationOptions): DynamicModule {
		return {
			module: GauzyAIModule,
			imports: [
				ConfigModule, // Make sure to import ConfigModule here
			],
			providers: [
				{
					provide: 'CONFIG_OPTIONS',
					useFactory: (config: ConfigService): ConfigurationOptions => ({
						apiKey: config.get('guazyAI.gauzyAiApiKey', ''),
						apiSecret: config.get('guazyAI.gauzyAiApiSecret', ''),
						...options,
					}),
					inject: [ConfigService],
				},
			],
			exports: ['CONFIG_OPTIONS'],
		};
	}
}
