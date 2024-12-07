import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { AvailabilitySlot } from '../availability-slots.entity';

export class MikroOrmAvailabilitySlotRepository extends MikroOrmBaseEntityRepository<AvailabilitySlot> { }
