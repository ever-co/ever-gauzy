import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAvailabilitySlotsCreateInput } from '@gauzy/contracts';
import { AvailabilitySlot } from './availability-slots.entity';
import { TenantAwareCrudService } from '../core';

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
	): Promise<AvailabilitySlot[]> {
		return this.availabilitySlotsRepository.save(availabilitySlots);
	}
}
