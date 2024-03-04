import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
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
		MikroOrmModule.forFeature([
			IntegrationSetting
		]),
		TenantModule,
		RolePermissionModule,
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
		MikroOrmModule,
		IntegrationSettingService
	]
})
export class IntegrationSettingModule { }
