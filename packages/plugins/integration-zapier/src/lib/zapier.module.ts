// zapier.module.ts
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@gauzy/config';
import {
    IntegrationEntitySettingModule,
    IntegrationMapModule,
    IntegrationModule,
    IntegrationSettingModule,
    IntegrationTenantModule,
    UserModule
} from '@gauzy/core';
import { ZAPIER_API_URL } from './zapier.config';
import { ZapierService } from './zapier.service';
import { ZapierController } from './zapier.controller';
import { ZapierAuthorizationController } from './zapier-authorization.controller';
import { CommandHandlers } from './handlers';

@Module({
    imports: [
        HttpModule.register({ baseURL: ZAPIER_API_URL }),
        CqrsModule,
        ConfigModule,
        IntegrationEntitySettingModule,
        IntegrationMapModule,
        IntegrationModule,
        IntegrationSettingModule,
        IntegrationTenantModule,
        UserModule
    ],
    controllers: [ZapierAuthorizationController, ZapierController],
    providers: [ZapierService, ...CommandHandlers ],
    exports: [ZapierService]
})
export class ZapierModule {}
