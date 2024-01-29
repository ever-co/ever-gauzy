import { Repository } from 'typeorm';
import { AvailabilitySlot } from '../availability-slots.entity';

export class TypeOrmAvailabilitySlotRepository extends Repository<AvailabilitySlot> { }
