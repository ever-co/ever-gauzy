import { EntityRepository } from '@mikro-orm/knex';
import { TimeSlotMinute } from '../time-slot-minute.entity';

export class MikroOrmTimeSlotMinuteRepository extends EntityRepository<TimeSlotMinute> { }
