import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CqrsModule } from '@nestjs/cqrs';
import { HUBSTAFF_API_URL } from '@gauzy/integration-hubstaff';
import { UserModule } from 'user/user.module';
import { RoleModule } from 'role/role.module';
import { RolePermissionModule } from 'role-permission/role-permission.module';
import { TenantModule } from 'tenant/tenant.module';
import { OrganizationModule } from 'organization/organization.module';
import { IntegrationEntitySettingModule } from 'integration-entity-setting/integration-entity-setting.module';
import { IntegrationEntitySettingTiedModule } from 'integration-entity-setting-tied/integration-entity-setting-tied.module';
import { IntegrationModule } from 'integration/integration.module';
import { IntegrationMapModule } from 'integration-map/integration-map.module';
import { IntegrationTenantModule } from 'integration-tenant/integration-tenant.module';
import { IntegrationSettingModule } from 'integration-setting/integration-setting.module';
import { OrganizationProjectModule } from 'organization-project/organization-project.module';
import { ScreenshotModule } from 'time-tracking/screenshot/screenshot.module';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { HubstaffAuthorizationController } from './hubstaff-authorization.controller';

@Module({
	imports: [
		HttpModule.register({ baseURL: HUBSTAFF_API_URL }),
		TenantModule,
		UserModule,
		RoleModule,
		OrganizationModule,
		RolePermissionModule,
		OrganizationProjectModule,
		forwardRef(() => IntegrationModule),
		IntegrationTenantModule,
		IntegrationSettingModule,
		IntegrationEntitySettingModule,
		IntegrationEntitySettingTiedModule,
		IntegrationMapModule,
		ScreenshotModule,
		CqrsModule
	],
	controllers: [
		HubstaffAuthorizationController,
		HubstaffController
	],
	providers: [
		HubstaffService
	]
})
export class HubstaffModule { }
