import { EntityRepository } from '@mikro-orm/knex';
import { AvailabilitySlot } from '../availability-slots.entity';

export class MikroOrmAvailabilitySlotRepository extends EntityRepository<AvailabilitySlot> { }
