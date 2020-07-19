import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationEntitySetting])],
	controllers: [IntegrationEntitySettingController],
	providers: [IntegrationEntitySettingService]
})
export class IntegrationEntitySettingModule {}
