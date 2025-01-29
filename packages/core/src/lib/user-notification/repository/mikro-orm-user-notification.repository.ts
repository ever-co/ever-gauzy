import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { UserNotification } from '../user-notification.entity';

export class MikroOrmUserNotificationRepository extends MikroOrmBaseEntityRepository<UserNotification> {}
