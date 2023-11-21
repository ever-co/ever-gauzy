import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import github from './config/github';
import { ConfigService } from './config.service';

@Global()
@Module({
	imports: [
		NestConfigModule.forRoot({
			isGlobal: true,
			load: [github],
		}),
	],
	providers: [ConfigService],
	exports: [ConfigService]
})
export class ConfigModule { }
