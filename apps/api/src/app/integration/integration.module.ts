import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { Integration } from './integration.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant, TenantService } from '../tenant';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([Integration, IntegrationSetting, Tenant])
	],
	controllers: [IntegrationController],
	providers: [IntegrationService, IntegrationSettingService, TenantService]
})
export class IntegrationModule {}
