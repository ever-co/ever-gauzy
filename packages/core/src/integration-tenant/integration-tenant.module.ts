import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { IntegrationTenantController } from './integration-tenant.controller';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenant } from './integration-tenant.entity';
import { IntegrationSettingModule } from './../integration-setting/integration-setting.module';
import { IntegrationEntitySettingModule } from './../integration-entity-setting/integration-entity-setting.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integration-tenant', module: IntegrationTenantModule }
		]),
		TypeOrmModule.forFeature([
			IntegrationTenant
		]),
		TenantModule,
		RoleModule,
		RolePermissionsModule,
		UserModule,
		forwardRef(() => IntegrationSettingModule),
		forwardRef(() => IntegrationEntitySettingModule),
		CqrsModule
	],
	exports: [
		IntegrationTenantService
	],
	controllers: [IntegrationTenantController],
	providers: [
		IntegrationTenantService,
		...CommandHandlers
	]
})
export class IntegrationTenantModule {}
