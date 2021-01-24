import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { AvailabilitySlot } from './availability-slots.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';
import { IAvailabilitySlotsCreateInput } from '@gauzy/contracts';

@Injectable()
export class AvailabilitySlotsService extends CrudService<AvailabilitySlot> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>
	) {
		super(availabilitySlotsRepository);
	}

	public async findAll(
		filter?: FindManyOptions<AvailabilitySlot>
	): Promise<IPagination<AvailabilitySlot>> {
		const total = await this.repository.count(filter);
		const items = await this.repository.find(filter);

		return { items, total };
	}

	public async createBulk(
		availabilitySlots: IAvailabilitySlotsCreateInput[]
	): Promise<AvailabilitySlot[]> {
		return this.availabilitySlotsRepository.save(availabilitySlots);
	}
}
