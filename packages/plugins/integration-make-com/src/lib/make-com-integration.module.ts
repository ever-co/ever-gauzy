import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TimerStartedHandler,
  TimerStoppedHandler,
  TimerStatusUpdatedHandler
} from './handlers';
import { WebhookService } from './webhook.service';
import { IntegrationModule, IntegrationSetting, IntegrationSettingModule, IntegrationTenantModule, UserModule } from '@gauzy/core';
import { MakeComSettingsController } from './make-com-settings.controller';
import { MakeComSettingsService } from './make-com-settings.service';

@Module({})
export class MakeComIntegrationModule {
  static forRoot(options?: {isGlobal?: boolean}): DynamicModule {
    return {
      global: options?.isGlobal || false,
      module: MakeComIntegrationModule,
      imports: [
        HttpModule,
        ConfigModule,
        CqrsModule,
        TypeOrmModule.forFeature([IntegrationSetting]),
        IntegrationModule,
        IntegrationSettingModule,
        IntegrationTenantModule,
        UserModule
      ],
      controllers: [MakeComSettingsController],
      providers: [
        WebhookService,
        MakeComSettingsService,
        TimerStartedHandler,
        TimerStoppedHandler,
        TimerStatusUpdatedHandler
      ],
      exports: [WebhookService, MakeComSettingsService]
    };
  }
}
