import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserNotification } from './user-notification.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserNotificationService } from './user-notification.service';
import { UserNotificationController } from './user-notification.controller';
import { EventHandlers } from './events/handlers';
import { TypeOrmUserNotificationRepository } from './repository/type-orm-user-notification.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([UserNotification]),
		MikroOrmModule.forFeature([UserNotification]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [UserNotificationController],
	providers: [UserNotificationService, TypeOrmUserNotificationRepository, ...EventHandlers],
	exports: [UserNotificationService, TypeOrmUserNotificationRepository]
})
export class UserNotificationModule {}
