import { EntityRepository } from '@mikro-orm/core';
import { AvailabilitySlot } from '../availability-slots.entity';

export class MikroOrmAvailabilitySlotRepository extends EntityRepository<AvailabilitySlot> { }
