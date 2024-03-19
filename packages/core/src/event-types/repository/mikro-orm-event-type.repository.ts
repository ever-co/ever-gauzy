import { EntityRepository } from '@mikro-orm/knex';
import { EventType } from '../event-type.entity';

export class MikroOrmEventTypeRepository extends EntityRepository<EventType> { }
