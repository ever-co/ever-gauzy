import { Module } from '@nestjs/common';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationSetting])],
	controllers: [IntegrationSettingController],
	providers: [IntegrationSettingService]
})
export class IntegrationSettingModule {}
