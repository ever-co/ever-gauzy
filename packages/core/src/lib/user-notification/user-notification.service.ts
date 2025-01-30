import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '../core/crud';
import { UserNotification } from './user-notification.entity';
import { TypeOrmUserNotificationRepository } from './repository/type-orm-user-notification.repository';
import { MikroOrmUserNotificationRepository } from './repository/mikro-orm-user-notification.repository';

@Injectable()
export class UserNotificationService extends TenantAwareCrudService<UserNotification> {
    constructor(readonly typeOrmUserNotificationRepository: TypeOrmUserNotificationRepository, readonly mikroOrmUserNotificationRepository: MikroOrmUserNotificationRepository) {
        super(typeOrmUserNotificationRepository, mikroOrmUserNotificationRepository);
    }
}
