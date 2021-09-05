import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAvailabilitySlot, IAvailabilitySlotsCreateInput } from '@gauzy/contracts';
import { AvailabilitySlot } from './availability-slots.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class AvailabilitySlotsService extends TenantAwareCrudService<AvailabilitySlot> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>
	) {
		super(availabilitySlotsRepository);
	}

	public async createBulk(
		availabilitySlots: IAvailabilitySlotsCreateInput[]
	): Promise<IAvailabilitySlot[]> {
		return await this.availabilitySlotsRepository.save(availabilitySlots);
	}
}
