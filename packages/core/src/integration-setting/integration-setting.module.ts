import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			IntegrationSetting
		]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [
		IntegrationSettingController
	],
	providers: [
		IntegrationSettingService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		IntegrationSettingService
	]
})
export class IntegrationSettingModule { }
