import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';
import { IntegrationEntitySettingTiedEntityController } from './integration-entity-setting-tied-entity.controller';
import { IntegrationEntitySettingTiedEntityService } from './integration-entity-setting-tied-entity.service';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationEntitySettingTiedEntity])],
	controllers: [IntegrationEntitySettingTiedEntityController],
	providers: [IntegrationEntitySettingTiedEntityService]
})
export class IntegrationEntitySettingTiedEntityModule {}
