import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySettingTiedEntityController } from './integration-entity-setting-tied-entity.controller';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entity.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySettingTiedEntity]),
		TenantModule
	],
	controllers: [IntegrationEntitySettingTiedEntityController],
	providers: [IntegrationEntitySettingTiedEntityService],
	exports: [IntegrationEntitySettingTiedEntityService]
})
export class IntegrationEntitySettingTiedEntityModule {}
