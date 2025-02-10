import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeNotification } from './employee-notification.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeNotificationSettingModule } from './employee-notification-setting/employee-notification-setting.module';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeNotificationController } from './employee-notification.controller';
import { EventHandlers } from './events/handlers';
import { TypeOrmEmployeeNotificationRepository } from './repository/type-orm-employee-notification.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([EmployeeNotification]),
		MikroOrmModule.forFeature([EmployeeNotification]),
		RolePermissionModule,
		EmployeeNotificationSettingModule
	],
	controllers: [EmployeeNotificationController],
	providers: [EmployeeNotificationService, TypeOrmEmployeeNotificationRepository, ...EventHandlers],
	exports: [EmployeeNotificationService, TypeOrmEmployeeNotificationRepository]
})
export class EmployeeNotificationModule {}
