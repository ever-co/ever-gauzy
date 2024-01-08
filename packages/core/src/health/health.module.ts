import { ConsoleLogger, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from './../database/database.module';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { HealthController } from './health.controller';

@Module({
	controllers: [HealthController],
	imports: [
		DatabaseModule,
		TerminusModule.forRoot({
			logger: ConsoleLogger
			// https://docs.nestjs.com/recipes/terminus#graceful-shutdown-timeout
			// gracefulShutdownTimeoutMs: 1000
		})
	],
	providers: [CacheHealthIndicator, RedisHealthIndicator]
})
export class HealthModule { }
