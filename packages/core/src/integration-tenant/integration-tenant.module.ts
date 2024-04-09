import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
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
		RouterModule.register([
			{ path: '/integration-tenant', module: IntegrationTenantModule }
		]),
		TypeOrmModule.forFeature([IntegrationTenant]),
		MikroOrmModule.forFeature([IntegrationTenant]),
		RoleModule,
		RolePermissionModule,
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationEntitySettingModule),
		CqrsModule
	],
	controllers: [IntegrationTenantController],
	providers: [IntegrationTenantService, TypeOrmIntegrationTenantRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationTenantService, TypeOrmIntegrationTenantRepository],
})
export class IntegrationTenantModule { }
