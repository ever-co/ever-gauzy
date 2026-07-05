import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@gauzy/config';
import {
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	PluginCommonModule,
	RolePermissionModule,
	TenantApiKeyModule
} from '@gauzy/core';
import { PlaneController } from './plane.controller';
import { PlaneIntegrationService } from './plane-integration.service';
import { PlaneProxyService } from './plane-proxy.service';

@Module({
	imports: [
		HttpModule,
		CqrsModule,
		ConfigModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		TenantApiKeyModule,
		PluginCommonModule,
		RolePermissionModule
	],
	controllers: [PlaneController],
	providers: [PlaneIntegrationService, PlaneProxyService],
	exports: [PlaneIntegrationService, PlaneProxyService]
})
export class PlaneModule {}
