import { EntityRepository } from '@mikro-orm/core';
import { EventType } from '../event-type.entity';

export class MikroOrmEventTypesRepository extends EntityRepository<EventType> { }
