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

@Module({
	imports: [
		HttpModule,
		TypeOrmModule.forFeature([
			Integration,
			Tenant,
			IntegrationSetting,
			IntegrationMap,
			OrganizationProjects
		])
	],
	controllers: [HubstaffController],
	providers: [
		HubstaffService,
		IntegrationService,
		TenantService,
		IntegrationSettingService,
		IntegrationMapService,
		OrganizationProjectsService
	]
})
export class HubstaffModule {}
