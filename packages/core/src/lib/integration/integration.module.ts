import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';
import { Integration } from './integration.entity';
import { IntegrationType } from './integration-type.entity';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { IntegrationTypeService } from './integration-type.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmIntegrationRepository } from './repository/type-orm-integration.repository';
import { TypeOrmIntegrationTypeRepository } from './repository/type-orm-integration-type.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Integration, IntegrationType]),
		MikroOrmModule.forFeature([Integration, IntegrationType]),
		CqrsModule,
		IntegrationTenantModule,
		RolePermissionModule
	],
	controllers: [IntegrationController],
	providers: [
		IntegrationService,
		IntegrationTypeService,
		TypeOrmIntegrationRepository,
		TypeOrmIntegrationTypeRepository,
		...CommandHandlers
	]
})
export class IntegrationModule {}
