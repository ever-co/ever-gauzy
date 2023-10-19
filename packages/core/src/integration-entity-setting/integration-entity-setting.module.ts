import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from './../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/integration-entity-setting',
				module: IntegrationEntitySettingModule
			}
		]),
		TypeOrmModule.forFeature([
			IntegrationEntitySetting
		]),
		forwardRef(() => IntegrationTenantModule),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [
		IntegrationEntitySettingController
	],
	providers: [
		IntegrationEntitySettingService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		IntegrationEntitySettingService
	]
})
export class IntegrationEntitySettingModule { }
