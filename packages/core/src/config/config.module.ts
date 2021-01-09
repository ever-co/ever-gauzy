import { Global, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '../logger/logger';
import { ConfigService } from './config.service';

@Global()
@Module({
  imports: [],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule implements OnApplicationBootstrap, OnApplicationShutdown {
  onApplicationBootstrap() {}

  onApplicationShutdown(signal: string) {
    if (signal) {
      new Logger().log(`Received shutdown signal: ${signal}`);
    }
  }
}
