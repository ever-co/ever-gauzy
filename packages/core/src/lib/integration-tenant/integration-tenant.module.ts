import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../event-bus/event-bus.module';
import { IntegrationTenantController } from './integration-tenant.controller';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationSettingModule } from './../integration-setting/integration-setting.module';
import { IntegrationEntitySettingModule } from './../integration-entity-setting/integration-entity-setting.module';
import { RoleModule } from '../role/role.module';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmIntegrationTenantRepository } from './repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationTenant]),
		MikroOrmModule.forFeature([IntegrationTenant]),
		RoleModule,
		RolePermissionModule,
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationEntitySettingModule),
		CqrsModule,
		EventBusModule
	],
	controllers: [IntegrationTenantController],
	providers: [IntegrationTenantService, TypeOrmIntegrationTenantRepository, ...CommandHandlers],
	exports: [IntegrationTenantService, TypeOrmIntegrationTenantRepository]
})
export class IntegrationTenantModule {}
