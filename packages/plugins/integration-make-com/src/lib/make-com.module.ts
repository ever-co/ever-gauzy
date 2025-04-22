import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import {
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	RolePermissionModule,
	UserModule
} from '@gauzy/core';
import { MakeComController } from './make-com.controller';
import { MakeComService } from './make-com.service';
import { WebhookService } from './webhook.service';
import { EventHandlers } from './handlers';

@Module({
	imports: [
		HttpModule,
		ConfigModule,
		CqrsModule,
		RolePermissionModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		UserModule
	],
	controllers: [MakeComController],
	providers: [WebhookService, MakeComService, ...EventHandlers],
	exports: [WebhookService, MakeComService]
})
export class MakeComModule {}
