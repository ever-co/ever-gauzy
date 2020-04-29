import { Module, HttpModule } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import { HubstaffController } from './hubstaff.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Integration } from '../integration/integration.entity';
import { IntegrationService } from '../integration/integration.service';
import { Tenant } from '../tenant/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationMap } from '../integration-map/integration-map.entity';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.entity';
import { IntegrationEntitySettingTiedEntityService } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.service';
import { RoleService } from '../role/role.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserModule } from '../user/user.module';
import { RoleModule } from '../role/role.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';

@Module({
	imports: [
		HttpModule,
		TypeOrmModule.forFeature([
			Integration,
			Tenant,
			IntegrationSetting,
			IntegrationMap,
			OrganizationProjects,
			IntegrationEntitySetting,
			IntegrationEntitySettingTiedEntity,
			Role,
			Organization,
			User
		]),
		CqrsModule,
		RoleModule,
		UserModule,
		RolePermissionsModule
	],
	controllers: [HubstaffController],
	providers: [
		HubstaffService,
		IntegrationService,
		TenantService,
		IntegrationSettingService,
		IntegrationMapService,
		OrganizationProjectsService,
		IntegrationEntitySettingService,
		IntegrationEntitySettingTiedEntityService,
		OrganizationService,
		RoleService,
		UserService
	]
})
export class HubstaffModule {}
