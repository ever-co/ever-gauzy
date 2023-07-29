import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GauzyAIService } from './gauzy-ai.service';
import gauzyAI from './config/gauzy-ai';

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
					...(config.get<string>('guazyAI.gauzyAiApiKey')
						? {
							'X-APP-ID': config.get<string>('guazyAI.gauzyAiApiKey')
						}
						: {}),
					...(config.get<string>('guazyAI.gauzyAiApiSecret')
						? {
							'X-API-KEY': config.get<string>('guazyAI.gauzyAiApiSecret')
						}
						: {})
				},
			}),
			inject: [ConfigService],
		}),
		ConfigModule.forFeature(gauzyAI),
	],
	controllers: [],
	providers: [GauzyAIService, ConfigService],
	exports: [GauzyAIService],
})
export class GauzyAIModule { }
