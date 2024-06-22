import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { i4netAIService } from './gauzy-ai.service';
import gauzyAI from './config/gauzy-ai';
import { IConfigurationOptions } from './configuration.interface';
import { RequestConfigProvider } from './request-config.provider';
import { i4net_AI_CONFIG_OPTIONS } from './constants';

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
					apiKey: config.get<string>('guazyAI.gauzyAiApiKey'),
					apiSecret: config.get<string>('guazyAI.gauzyAiApiSecret'),
				},
			}),
			inject: [ConfigService],
		}),
		ConfigModule.forFeature(gauzyAI), // Make sure to import ConfigModule here
	],
	controllers: [],
	providers: [
		i4netAIService,
		RequestConfigProvider,
	],
	exports: [
		i4netAIService,
		RequestConfigProvider,
	],
})
export class i4netAIModule {
	/**
	 *
	 * @param options
	 * @returns
	 */
	static forRoot(options?: IConfigurationOptions): DynamicModule {
		return {
			module: i4netAIModule,
			imports: [
				ConfigModule, // Make sure to import ConfigModule here
			],
			providers: [
				{
					provide: i4net_AI_CONFIG_OPTIONS,
					useFactory: (config: ConfigService): IConfigurationOptions => ({
						apiKey: config.get<string>('guazyAI.gauzyAiApiKey'),
						apiSecret: config.get<string>('guazyAI.gauzyAiApiSecret'),
						...options,
					}),
					inject: [ConfigService],
				},
			],
			exports: [
				i4net_AI_CONFIG_OPTIONS
			],
		};
	}
}
