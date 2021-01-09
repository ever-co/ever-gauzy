import { MiddlewareConsumer, Module, NestModule, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { LoggerModule } from '../logger/logger.module';
import { Logger } from '../logger/logger';
import { ApiModule } from '../api/api.module';
import { PluginModule } from '../plugin/plugin.module';
import { ConfigService } from '../config';
import { HealthIndicatorModule } from '../health-indicator/health-indicator.module';

@Module({
  imports: [ConfigModule, LoggerModule.forRoot(), ApiModule, PluginModule.forRoot(), HealthIndicatorModule],
})
export class BootstrapModule implements NestModule, OnApplicationShutdown {
  constructor(private configService: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    const { middleware } = this.configService.apiConfig;
    consumer.apply().forRoutes('*');
  }

  async onApplicationShutdown(signal: string) {
    if (signal) {
      Logger.log(`Received shutdown signal: ${signal}`);
    }
  }
}
