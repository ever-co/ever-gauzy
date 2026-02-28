import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConsoleLogger, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { CacheHealthIndicator } from './indicators/cache-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { User } from '../user/user.entity';

@Module({
	controllers: [HealthController],
	imports: [
		TypeOrmModule.forFeature([User]),
		MikroOrmModule.forFeature([User]),
		TerminusModule.forRoot({
			logger: ConsoleLogger
			// https://docs.nestjs.com/recipes/terminus#graceful-shutdown-timeout
			// gracefulShutdownTimeoutMs: 1000
		})
	],
	providers: [
		HealthService,
		CacheHealthIndicator,
		RedisHealthIndicator,
		TypeOrmUserRepository,
		MikroOrmUserRepository
	]
})
export class HealthModule {}
