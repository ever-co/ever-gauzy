import { Injectable } from '@nestjs/common';
import { IUserNotification, IUserNotificationCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { UserNotification } from './user-notification.entity';
import { TypeOrmUserNotificationRepository } from './repository/type-orm-user-notification.repository';
import { MikroOrmUserNotificationRepository } from './repository/mikro-orm-user-notification.repository';

@Injectable()
export class UserNotificationService extends TenantAwareCrudService<UserNotification> {
    constructor(readonly typeOrmUserNotificationRepository: TypeOrmUserNotificationRepository, readonly mikroOrmUserNotificationRepository: MikroOrmUserNotificationRepository) {
        super(typeOrmUserNotificationRepository, mikroOrmUserNotificationRepository);
    }

    async create(input: IUserNotificationCreateInput): Promise<IUserNotification> {
        try {
            // Retrieve the current tenant ID from the request context or use the provided tenantId
            const tenantId = RequestContext.currentTenantId() || input.tenantId;

            return await super.create({ ...input, tenantId });
        } catch (error) {

        }
    }
}
