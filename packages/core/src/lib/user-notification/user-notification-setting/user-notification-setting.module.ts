import { Module } from '@nestjs/common';
import { UserNotificationSettingService } from './user-notification-setting.service';
import { UserNotificationSettingController } from './user-notification-setting.controller';

@Module({
  providers: [UserNotificationSettingService],
  controllers: [UserNotificationSettingController]
})
export class UserNotificationSettingModule {}
