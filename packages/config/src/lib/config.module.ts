import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import configs from './config';

@Global()
@Module({
	imports: [
		/**
		 * The NestConfigModule.forRoot method is used to configure the root module for handling configuration settings.
		 * The 'load' option is used to load configuration modules for different providers.
		 */
		NestConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			load: [...configs]
		})
	],
	providers: [ConfigService],
	exports: [ConfigService]
})
export class ConfigModule {}
