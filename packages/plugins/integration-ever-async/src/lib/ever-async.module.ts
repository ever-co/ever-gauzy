import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@gauzy/config';
import {
	IntegrationModule,
	IntegrationSettingModule,
	IntegrationTenantModule,
	PluginCommonModule,
	RolePermissionModule
} from '@gauzy/core';
import { EverAsyncController } from './ever-async.controller';
import { EverAsyncIntegrationService } from './ever-async-integration.service';

@Module({
	imports: [
		HttpModule,
		ConfigModule,
		IntegrationModule,
		IntegrationSettingModule,
		IntegrationTenantModule,
		PluginCommonModule,
		RolePermissionModule
	],
	controllers: [EverAsyncController],
	providers: [EverAsyncIntegrationService],
	exports: [EverAsyncIntegrationService]
})
export class EverAsyncModule {}
