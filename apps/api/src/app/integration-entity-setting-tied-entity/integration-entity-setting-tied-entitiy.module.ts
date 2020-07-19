import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entitiy.entity';
import { IntegrationEntitySettingTiedEntityController } from './integration-entity-setting-tied-entitiy.controller';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entitiy.service';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationEntitySettingTiedEntity])],
	controllers: [IntegrationEntitySettingTiedEntityController],
	providers: [IntegrationEntitySettingTiedEntityService]
})
export class IntegrationEntitySettingTiedEntityModule {}
