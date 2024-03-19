import { EntityRepository } from '@mikro-orm/knex';
import { TimeSlot } from '../time-slot.entity';

export class MikroOrmTimeSlotRepository extends EntityRepository<TimeSlot> { }
