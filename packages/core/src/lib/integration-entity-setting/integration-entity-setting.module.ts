import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingController } from './integration-entity-setting.controller';
import { IntegrationEntitySettingService } from './integration-entity-setting.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationEntitySetting]),
		MikroOrmModule.forFeature([IntegrationEntitySetting]),
		forwardRef(() => IntegrationTenantModule),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IntegrationEntitySettingController],
	providers: [IntegrationEntitySettingService, ...CommandHandlers],
	exports: [IntegrationEntitySettingService]
})
export class IntegrationEntitySettingModule {}
