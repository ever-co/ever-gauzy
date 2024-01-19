import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IAvailabilitySlot, IAvailabilitySlotsCreateInput } from '@gauzy/contracts';
import { AvailabilitySlot } from './availability-slots.entity';
import { TenantAwareCrudService } from './../core/crud';
import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';

@Injectable()
export class AvailabilitySlotsService extends TenantAwareCrudService<AvailabilitySlot> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,
		@MikroInjectRepository(AvailabilitySlot)
		private readonly mikroAvailabilitySlotsRepository: EntityRepository<AvailabilitySlot>
	) {
		super(availabilitySlotsRepository, mikroAvailabilitySlotsRepository);
	}

	public async createBulk(
		availabilitySlots: IAvailabilitySlotsCreateInput[]
	): Promise<IAvailabilitySlot[]> {
		return await this.availabilitySlotsRepository.save(availabilitySlots);
	}
}
