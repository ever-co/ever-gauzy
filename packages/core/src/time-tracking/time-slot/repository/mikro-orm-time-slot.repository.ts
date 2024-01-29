import { EntityRepository } from '@mikro-orm/core';
import { TimeSlot } from '../time-slot.entity';

export class MikroOrmTimeSlotRepository extends EntityRepository<TimeSlot> { }