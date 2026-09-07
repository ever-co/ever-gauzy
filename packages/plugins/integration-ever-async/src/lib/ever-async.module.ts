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
import { EverAsyncConnectorController, EverAsyncConnectorGuard } from './ever-async-connector.controller';
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
	controllers: [EverAsyncController, EverAsyncConnectorController],
	providers: [EverAsyncIntegrationService, EverAsyncConnectorGuard],
	exports: [EverAsyncIntegrationService]
})
export class EverAsyncModule {}
