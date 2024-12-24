import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IAvailabilitySlot, IAvailabilitySlotsCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmAvailabilitySlotRepository } from './repository/type-orm-availability-slot.repository';
import { MikroOrmAvailabilitySlotRepository } from './repository/mikro-orm-availability-slot.repository';
import { AvailabilitySlot } from './availability-slots.entity';

@Injectable()
export class AvailabilitySlotsService extends TenantAwareCrudService<AvailabilitySlot> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		typeOrmAvailabilitySlotRepository: TypeOrmAvailabilitySlotRepository,

		mikroOrmAvailabilitySlotRepository: MikroOrmAvailabilitySlotRepository
	) {
		super(typeOrmAvailabilitySlotRepository, mikroOrmAvailabilitySlotRepository);
	}

	/**
	 *
	 * @param availabilitySlots
	 * @returns
	 */
	public async createBulk(availabilitySlots: IAvailabilitySlotsCreateInput[]): Promise<IAvailabilitySlot[]> {
		return await this.typeOrmRepository.save(availabilitySlots);
	}
}
