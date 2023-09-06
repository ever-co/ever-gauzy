import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { GauzyAIService } from './gauzy-ai.service';
import gauzyAI from './config/gauzy-ai';
import { ConfigurationOptions } from './configuration.interface';
import { RequestConfigProvider } from './request-config.provider';
import { GAUZY_AI_CONFIG_OPTIONS } from './constants';

@Module({
	imports: [
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService) => ({
				baseURL: config.get<string>('guazyAI.gauzyAIRESTEndpoint'),
				timeout: config.get<number>('guazyAI.gauzyAIRequestTimeout'),
				maxRedirects: 5,
				headers: {
					'Content-Type': 'application/json',
				},
			}),
			inject: [ConfigService],
		}),
		ConfigModule.forFeature(gauzyAI), // Make sure to import ConfigModule here
	],
	controllers: [],
	providers: [
		GauzyAIService,
		RequestConfigProvider,
	],
	exports: [
		GauzyAIService,
		RequestConfigProvider,
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
					provide: GAUZY_AI_CONFIG_OPTIONS,
					useFactory: (config: ConfigService): ConfigurationOptions => ({
						apiKey: config.get('guazyAI.gauzyAiApiKey'),
						apiSecret: config.get('guazyAI.gauzyAiApiSecret'),
						...options,
					}),
					inject: [ConfigService],
				},
			],
			exports: [
				GAUZY_AI_CONFIG_OPTIONS
			],
		};
	}
}
