import { Module } from '@nestjs/common';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationSetting]),
		CqrsModule,
		TenantModule
	],
	controllers: [IntegrationSettingController],
	providers: [IntegrationSettingService, ...CommandHandlers],
	exports: [IntegrationSettingService]
})
export class IntegrationSettingModule {}
