import { Controller, UseGuards } from '@nestjs/common';
import { TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { UserNotificationService } from './user-notification.service';

@UseGuards(TenantPermissionGuard)
@Permissions()
@Controller('/user-notification')
export class UserNotificationController {
    constructor(readonly _userNotificationService: UserNotificationService) { }
}
