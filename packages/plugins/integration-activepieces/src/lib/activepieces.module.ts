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
import { ActivepiecesAuthorizationController } from './activepieces-authorization.controller';
import { ActivepiecesMcpService } from './activepieces-mcp.service';
import { ActivepiecesMcpController } from './activepieces-mcp.controller';

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
	controllers: [ActivepiecesAuthorizationController, ActivepiecesController, ActivepiecesMcpController],
	providers: [ActivepiecesService, ActivepiecesMcpService],
	exports: [ActivepiecesService, ActivepiecesMcpService]
})
export class ActivepiecesModule {}
