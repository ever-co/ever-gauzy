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
import { MakeComAuthorizationController } from './make-com-authorization.controller';
import { MakeComService } from './make-com.service';
import { WebhookService } from './webhook.service';
import { EventHandlers } from './handlers';
import { MakeComOAuthService } from './make-com-oauth.service';

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
	controllers: [MakeComController, MakeComAuthorizationController],
	providers: [WebhookService, MakeComService, MakeComOAuthService, ...EventHandlers],
	exports: [WebhookService, MakeComService, MakeComOAuthService],
})
export class MakeComModule {}
