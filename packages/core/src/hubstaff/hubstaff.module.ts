import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TenantModule } from './../tenant/tenant.module';
import { OrganizationModule } from './../organization/organization.module';
import { IntegrationEntitySettingModule } from './../integration-entity-setting/integration-entity-setting.module';
import { IntegrationEntitySettingTiedModule } from './../integration-entity-setting-tied/integration-entity-setting-tied.module';
import { IntegrationMapModule } from './../integration-map/integration-map.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';
import { IntegrationSettingModule } from './../integration-setting/integration-setting.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/integrations/hubstaff', module: HubstaffModule }
		]),
		HttpModule,
		TenantModule,
		RoleModule,
		RolePermissionModule,
		UserModule,
		OrganizationModule,
		OrganizationProjectModule,
		IntegrationTenantModule,
		IntegrationSettingModule,
		IntegrationEntitySettingModule,
		IntegrationEntitySettingTiedModule,
		IntegrationMapModule,
		CqrsModule
	],
	controllers: [HubstaffController],
	providers: [HubstaffService]
})
export class HubstaffModule {}
