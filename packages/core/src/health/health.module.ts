import { ConsoleLogger, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CustomHealthIndicator } from './custom-health.indicator';
import { HealthController } from './health.controller';

@Module({
	controllers: [HealthController],
	imports: [
		TerminusModule.forRoot({
			logger: ConsoleLogger
			// https://docs.nestjs.com/recipes/terminus#graceful-shutdown-timeout
			// gracefulShutdownTimeoutMs: 1000
		})
	],
	providers: [CustomHealthIndicator]
})
export class HealthModule {}
