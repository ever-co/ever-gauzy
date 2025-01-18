import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { CommandHandlers } from './commands/handlers';
import { IntegrationTenantModule } from '../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Integration, IntegrationType]),
		MikroOrmModule.forFeature([Integration, IntegrationType]),
		CqrsModule,
		IntegrationTenantModule,
		RolePermissionModule
	],
	controllers: [IntegrationController],
	providers: [IntegrationService, ...CommandHandlers],
	exports: [IntegrationService]
})
export class IntegrationModule {}
