import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmployeeNotification } from '../employee-notification.entity';

export class MikroOrmEmployeeNotificationRepository extends MikroOrmBaseEntityRepository<EmployeeNotification> {}
