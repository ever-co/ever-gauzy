import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { IntegrationSettingController } from './integration-setting.controller';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TypeOrmIntegrationSettingRepository } from './repository/type-orm-integration-setting.repository';
import { MikroOrmIntegrationSettingRepository } from './repository/mikro-orm-integration-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([IntegrationSetting]),
		MikroOrmModule.forFeature([IntegrationSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [IntegrationSettingController],
	providers: [IntegrationSettingService, TypeOrmIntegrationSettingRepository, MikroOrmIntegrationSettingRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, IntegrationSettingService, TypeOrmIntegrationSettingRepository, MikroOrmIntegrationSettingRepository]
})
export class IntegrationSettingModule {}