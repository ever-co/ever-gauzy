import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { UserNotificationSettingService } from './user-notification-setting.service';
import { UserNotificationSettingController } from './user-notification-setting.controller';
import { UserNotificationSetting } from './user-notification-setting.entity';
import { TypeOrmUserNotificationSettingRepository } from './repository/type-orm-user-notification-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([UserNotificationSetting]),
		MikroOrmModule.forFeature([UserNotificationSetting]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [UserNotificationSettingController],
	providers: [UserNotificationSettingService, TypeOrmUserNotificationSettingRepository]
})
export class UserNotificationSettingModule {}
