import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, environment } from '@gauzy/config';
import {
    IntegrationEntitySettingModule,
    IntegrationMapModule,
    IntegrationModule,
    IntegrationSettingModule,
    IntegrationTenantModule,
    UserModule,
    RolePermissionModule,
    TimerModule,
    CommandHandlers,
    QueryHandlers
} from '@gauzy/core';
import { ZapierService } from './zapier.service';
import { ZapierController } from './zapier.controller';
import { ZapierAuthorizationController } from './zapier-authorization.controller';
import { ZapierWebhookService } from './zapier-webhook.service';
import { ZapierWebhookController } from './zapier-webhook.controller';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';
import { MikroOrmZapierWebhookSubscriptionRepository } from './repository/mikro-orm-zapier.repository';
import { TypeOrmZapierWebhookSubscriptionRepository } from './repository/type-orm-zapier.repository';

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
        TypeOrmModule.forFeature([ZapierWebhookSubscription]),
        MikroOrmModule.forFeature([ZapierWebhookSubscription])
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
export class ZapierModule { }
