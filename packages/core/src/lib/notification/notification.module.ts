import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Notification } from './notification.entity';
import { TypeOrmNotificationRepository } from './repository/type-orm.notification.repository';

@Module({
    imports: [
		TypeOrmModule.forFeature([Notification]),
		MikroOrmModule.forFeature([Notification]),
		RolePermissionModule,
	],
	providers: [ TypeOrmNotificationRepository]
})
export class NotificationModule {}
