import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { GauzyAIService } from './gauzy-ai.service';
import gauzyAI from './config/gauzy-ai';
import { IConfigurationOptions } from './configuration.interface';
import { RequestConfigProvider } from './request-config.provider';
import { GAUZY_AI_CONFIG_OPTIONS } from './constants';

@Module({
	imports: [
		HttpModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService) => ({
				baseURL: config.get<string>('gauzyAI.gauzyAIRESTEndpoint'),
				timeout: config.get<number>('gauzyAI.gauzyAIRequestTimeout'),
				maxRedirects: 5,
				headers: {
					'Content-Type': 'application/json',
					apiKey: config.get<string>('gauzyAI.gauzyAiApiKey'),
					apiSecret: config.get<string>('gauzyAI.gauzyAiApiSecret')
				}
			}),
			inject: [ConfigService]
		}),
		ConfigModule.forFeature(gauzyAI) // Make sure to import ConfigModule here
	],
	controllers: [],
	providers: [GauzyAIService, RequestConfigProvider],
	exports: [GauzyAIService, RequestConfigProvider]
})
export class GauzyAIModule {
	/**
	 * Configure the GauzyAI module for integration with Ever Gauzy Platform.
	 * @param options Optional configuration options for GauzyAI.
	 * @returns A dynamic module configuration object.
	 */
	static forRoot(options?: IConfigurationOptions): DynamicModule {
		return {
			module: GauzyAIModule,
			imports: [ConfigModule], // Make sure to import ConfigModule here
			providers: [
				{
					provide: GAUZY_AI_CONFIG_OPTIONS,
					useFactory: (config: ConfigService): IConfigurationOptions => ({
						apiKey: config.get<string>('gauzyAI.gauzyAiApiKey'),
						apiSecret: config.get<string>('gauzyAI.gauzyAiApiSecret'),
						...options
					}),
					inject: [ConfigService]
				}
			],
			exports: [GAUZY_AI_CONFIG_OPTIONS]
		};
	}
}
