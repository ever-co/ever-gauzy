import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import github from './config/github';
import twitter from './config/twitter';

@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			load: [github, twitter],
		}),
	],
	providers: [ConfigService],
	exports: [ConfigService]
})
export class ConfigModule { }
