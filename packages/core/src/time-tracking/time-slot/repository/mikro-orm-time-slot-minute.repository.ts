import { EntityRepository } from '@mikro-orm/core';
import { TimeSlotMinute } from '../time-slot-minute.entity';

export class MikroOrmTimeSlotMinuteRepository extends EntityRepository<TimeSlotMinute> { }
