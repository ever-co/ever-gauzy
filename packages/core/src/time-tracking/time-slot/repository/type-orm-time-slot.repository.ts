import { Repository } from 'typeorm';
import { TimeSlot } from '../time-slot.entity';

export class TypeOrmTimeSlotRepository extends Repository<TimeSlot> { }