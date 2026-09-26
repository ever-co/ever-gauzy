import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeNotification } from './employee-notification.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeNotificationSettingModule } from '../employee-notification-setting/employee-notification-setting.module';
import { EmployeeNotificationService } from './employee-notification.service';
import { EmployeeNotificationController } from './employee-notification.controller';
import { EmployeeNotificationResolver } from './employee-notification.resolver';
import { EventHandlers } from './events/handlers';
import { TypeOrmEmployeeNotificationRepository } from './repository/type-orm-employee-notification.repository';
import { MikroOrmEmployeeNotificationRepository } from './repository/mikro-orm-employee-notification.repository';

/**
 * The notification inbox.
 *
 * The GraphQL view of the same resource is declared here, beside the service it calls, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach. It
 * injects the service, which this module already provides and exports, and nothing beside it: this
 * resource's routes reach the service directly — the CRUD base's and the mark-all write alike — so no
 * command bus is injected and `CqrsModule` stays what it already was, the module the event handlers
 * resolve their bus from.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([EmployeeNotification]),
		MikroOrmModule.forFeature([EmployeeNotification]),
		EmployeeNotificationSettingModule,
		RolePermissionModule
	],
	controllers: [EmployeeNotificationController],
	providers: [
		EmployeeNotificationService,
		// The GraphQL view of the same resource.
		EmployeeNotificationResolver,
		TypeOrmEmployeeNotificationRepository,
		MikroOrmEmployeeNotificationRepository,
		...EventHandlers
	],
	exports: [EmployeeNotificationService]
})
export class EmployeeNotificationModule {}