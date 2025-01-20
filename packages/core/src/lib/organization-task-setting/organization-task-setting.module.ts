import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationTaskSettingController } from './organization-task-setting.controller';
import { OrganizationTaskSettingService } from './organization-task-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationTaskSetting } from './organization-task-setting.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmOrganizationTaskSettingRepository } from './repository/type-orm-organization-task-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationTaskSetting]),
		MikroOrmModule.forFeature([OrganizationTaskSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationTaskSettingController],
	providers: [OrganizationTaskSettingService, TypeOrmOrganizationTaskSettingRepository, ...CommandHandlers],
	exports: [OrganizationTaskSettingService, TypeOrmOrganizationTaskSettingRepository]
})
export class OrganizationTaskSettingModule {}
