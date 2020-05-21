import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { AvailabilitySlots } from './availability-slots.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';
import { IAvailabilitySlotsCreateInput } from '@gauzy/models';

@Injectable()
export class AvailabilitySlotsService extends CrudService<AvailabilitySlots> {
	constructor(
		@InjectRepository(AvailabilitySlots)
		private readonly availabilitySlotsRepository: Repository<
			AvailabilitySlots
		>
	) {
		super(availabilitySlotsRepository);
	}

	public async findAll(
		filter?: FindManyOptions<AvailabilitySlots>
	): Promise<IPagination<AvailabilitySlots>> {
		const total = await this.repository.count(filter);
		let items = await this.repository.find(filter);

		return { items, total };
	}

	public async createBulk(
		availabilitySlots: IAvailabilitySlotsCreateInput[]
	): Promise<AvailabilitySlots[]> {
		return this.availabilitySlotsRepository.save(availabilitySlots);
	}
}
