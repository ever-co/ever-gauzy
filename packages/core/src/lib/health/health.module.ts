import { ConsoleLogger, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { HealthController } from './health.controller';

@Module({
	controllers: [HealthController],
	imports: [
		// We need to import the TypeOrmModule and MikroOrmModule here to use Repositories in Health Service
		UserModule,
		DatabaseModule,
		TerminusModule.forRoot({
			logger: ConsoleLogger
			// https://docs.nestjs.com/recipes/terminus#graceful-shutdown-timeout
			// gracefulShutdownTimeoutMs: 1000
		})
	],
	providers: [CacheHealthIndicator, RedisHealthIndicator]
})
export class HealthModule {}
