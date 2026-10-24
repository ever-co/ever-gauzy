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
	UserModule
} from '@gauzy/core';
import { ACTIVEPIECES_API_URL } from './activepieces.config';
import { ActivepiecesService } from './activepieces.service';
import { ActivepiecesController } from './activepieces.controller';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import { ActivepiecesMcpController } from './activepieces-mcp.controller';
import { ActivepiecesCredentialsService } from './activepieces-credentials.service';
import { ActivepiecesOperatorGuard } from './activepieces-operator.guard';
import { ActivepiecesPlatformController } from './activepieces-platform.controller';
import { ActivepiecesPlatformService } from './activepieces-platform.service';

@Module({
	imports: [
		HttpModule.register({ baseURL: ACTIVEPIECES_API_URL }),
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
		UserModule
	],
	controllers: [
		ActivepiecesController,
		ActivepiecesMcpController,
		ActivepiecesPlatformController
	],
	providers: [
		ActivepiecesCredentialsService,
		ActivepiecesService,
		ActivepiecesMcpService,
		ActivepiecesPlatformService,
		ActivepiecesOperatorGuard
	],
	exports: [ActivepiecesService, ActivepiecesMcpService]
})
export class ActivepiecesModule {}
