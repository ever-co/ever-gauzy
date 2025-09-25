import { MikroOrmModule } from '@mikro-orm/nestjs';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ActivepiecesConfigService } from './activepieces-config.service';
import { ActivepiecesConfigController } from './activepieces-config.controller';
import { ActivepiecesIntegration } from './activepieces-integration.entity';
import { MikroOrmActivepiecesIntegrationRepository } from './repository/mikro-orm-activepieces-integration.repository';
import { TypeOrmActivepiecesIntegrationRepository } from './repository/type-orm-activepieces-integration.repository';

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
		UserModule,
		TypeOrmModule.forFeature([ActivepiecesIntegration]),
		MikroOrmModule.forFeature([ActivepiecesIntegration])
	],
	controllers: [
		ActivepiecesAuthorizationController,
		ActivepiecesController,
		ActivepiecesMcpController,
		ActivepiecesConfigController
	],
	providers: [
		ActivepiecesService,
		ActivepiecesMcpService,
		ActivepiecesConfigService,
		MikroOrmActivepiecesIntegrationRepository,
		TypeOrmActivepiecesIntegrationRepository
	],
	exports: [ActivepiecesService, ActivepiecesMcpService, ActivepiecesConfigService]
})
export class ActivepiecesModule {}
