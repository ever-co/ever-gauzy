import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Notification } from '../notification.entity';

export class MikroOrmNotificationRepository extends MikroOrmBaseEntityRepository<Notification> {}
