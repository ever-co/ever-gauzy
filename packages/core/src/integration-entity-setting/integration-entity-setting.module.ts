import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/integration-entity-setting',
				module: IntegrationEntitySettingModule
			}
		]),
		TypeOrmModule.forFeature([IntegrationEntitySetting]),
		forwardRef(() => TenantModule),
		forwardRef(() => IntegrationTenantModule),
		CqrsModule
	],
	controllers: [IntegrationEntitySettingController],
	providers: [
		IntegrationEntitySettingService,
		...CommandHandlers
	],
	exports: [IntegrationEntitySettingService]
})
export class IntegrationEntitySettingModule {}
