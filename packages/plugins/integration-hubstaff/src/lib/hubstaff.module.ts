import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@gauzy/config';
import {
	IntegrationEntitySettingModule,
	IntegrationEntitySettingTiedModule,
	IntegrationMapModule,
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	OrganizationModule,
	OrganizationProjectModule,
	RoleModule,
	RolePermissionModule,
	ScreenshotModule,
	UserModule
} from '@gauzy/core';
import { HUBSTAFF_API_URL } from './hubstaff.config';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { HubstaffAuthorizationController } from './hubstaff-authorization.controller';

@Module({
	imports: [
		HttpModule.register({ baseURL: HUBSTAFF_API_URL }),
		CqrsModule,
		ConfigModule,
		IntegrationEntitySettingModule,
		IntegrationEntitySettingTiedModule,
		IntegrationMapModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		OrganizationModule,
		OrganizationProjectModule,
		RoleModule,
		RolePermissionModule,
		ScreenshotModule,
		UserModule
	],
	controllers: [HubstaffAuthorizationController, HubstaffController],
	providers: [HubstaffService]
})
export class HubstaffModule {}
