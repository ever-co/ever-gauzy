import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { Integration } from './integration.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			Integration,
			IntegrationSetting,
			Tenant,
			IntegrationEntitySetting
		]),
		RoleModule,
		UserModule,
		RolePermissionsModule
	],
	controllers: [IntegrationController],
	providers: [
		IntegrationService,
		IntegrationSettingService,
		TenantService,
		IntegrationEntitySettingService
	]
})
export class IntegrationModule {}
