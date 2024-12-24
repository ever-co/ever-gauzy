import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EventType } from '../event-type.entity';

export class MikroOrmEventTypeRepository extends MikroOrmBaseEntityRepository<EventType> { }
