import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EventDelivery } from '../event-delivery.entity';

export class MikroOrmEventDeliveryRepository extends MikroOrmBaseEntityRepository<EventDelivery> {}
