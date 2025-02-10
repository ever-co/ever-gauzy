import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';
import { EmployeeNotificationSettingController } from './employee-notification-setting.controller';
import { TypeOrmEmployeeNotificationSettingRepository } from './repository/type-orm-employee-notification-setting.repository';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';

@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeNotificationSetting]),
		MikroOrmModule.forFeature([EmployeeNotificationSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeNotificationSettingController],
	providers: [EmployeeNotificationSettingService, TypeOrmEmployeeNotificationSettingRepository, ...CommandHandlers],
	exports: [EmployeeNotificationSettingService]
})
export class EmployeeNotificationSettingModule {}
