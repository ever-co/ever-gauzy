import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySetting]),
		TenantModule
	],
	controllers: [IntegrationEntitySettingController],
	providers: [IntegrationEntitySettingService]
})
export class IntegrationEntitySettingModule {}
