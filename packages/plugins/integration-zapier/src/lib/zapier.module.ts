import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule, environment } from '@gauzy/config';
import {
    IntegrationEntitySettingModule,
    IntegrationMapModule,
    IntegrationModule,
    IntegrationSettingModule,
    IntegrationTenantModule,
    UserModule,
    RolePermissionModule
} from '@gauzy/core';
import { ZAPIER_API_URL } from './zapier.config';
import { ZapierService } from './zapier.service';
import { ZapierController } from './zapier.controller';
import { ZapierAuthorizationController } from './zapier-authorization.controller';
import { CommandHandlers } from '@gauzy/core';
import { QueryHandlers } from '@gauzy/core';
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierWebhookController } from './zapier-webhook.controller';
import { MikroOrmZapierWebhookSubscriptionRepository } from './repository/mikro-orm-zapier.repository';
import { TypeOrmZapierWebhookSubscriptionRepository } from './repository/type-orm-zapier.repository';
import { ZapierWebhookSubscriptionRepository } from './repository/zapier-repository.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TimerModule } from '@gauzy/core';

@Module({
    imports: [
        HttpModule.register({ baseURL: environment.baseUrl }),
        CqrsModule,
        ConfigModule,
        IntegrationEntitySettingModule,
        IntegrationMapModule,
        IntegrationModule,
        RolePermissionModule,
        IntegrationSettingModule,
        IntegrationTenantModule,
        UserModule,
        TimerModule,
        TypeOrmModule.forFeature([ZapierWebhookSubscriptionRepository]),
        MikroOrmModule.forFeature([ZapierWebhookSubscriptionRepository])
    ],
    controllers: [ZapierAuthorizationController, ZapierController, ZapierWebhookController],
    providers: [
                ZapierService,
                ZapierWebhookService,
                MikroOrmZapierWebhookSubscriptionRepository,
                TypeOrmZapierWebhookSubscriptionRepository,
                ...CommandHandlers,
                ...QueryHandlers
                ],
    exports: [ZapierService, ZapierWebhookService, TimerModule]
})
export class ZapierModule {}
