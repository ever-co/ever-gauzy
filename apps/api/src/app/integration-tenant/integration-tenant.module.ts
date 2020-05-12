import { Module } from '@nestjs/common';
import { IntegrationTenantController } from './integration-tenant.controller';
import { IntegrationTenantService } from './integration-tenant.service';
import { IntegrationTenant } from './integration-tenant.entity';
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
			IntegrationTenant,
			IntegrationSetting,
			Tenant,
			IntegrationEntitySetting
		]),
		RoleModule,
		UserModule,
		RolePermissionsModule
	],
	controllers: [IntegrationTenantController],
	providers: [
		IntegrationTenantService,
		IntegrationSettingService,
		TenantService,
		IntegrationEntitySettingService
	]
})
export class IntegrationTenantModule {}
