import { MiddlewareConsumer, Module, NestModule, OnApplicationShutdown } from '@nestjs/common';
import { PluginModule } from '@gauzy/plugin';
import { ConfigModule, ConfigService } from '../config';
import { ApiModule } from '../api';
import { HealthIndicatorModule } from '../health-indicator';
import { Logger, LoggerModule } from '../logger';

@Module({
  imports: [ConfigModule, LoggerModule.forRoot(), ApiModule, HealthIndicatorModule, PluginModule.forRoot()],
  exports: [ConfigModule],
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
