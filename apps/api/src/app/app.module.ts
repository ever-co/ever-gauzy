import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
