import { Module } from '@nestjs/common';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationSetting]), CqrsModule],
	controllers: [IntegrationSettingController],
	providers: [IntegrationSettingService, ...CommandHandlers]
})
export class IntegrationSettingModule {}
