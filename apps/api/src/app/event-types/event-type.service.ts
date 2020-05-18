import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { EventType } from './event-type.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';

@Injectable()
export class EventTypeService extends CrudService<EventType> {
	constructor(
		@InjectRepository(EventType)
		private readonly eventTypeRepository: Repository<EventType>
	) {
		super(eventTypeRepository);
	}

	public async findAll(
		filter?: FindManyOptions<EventType>
	): Promise<IPagination<EventType>> {
		const total = await this.repository.count(filter);
		let items = await this.repository.find(filter);

		return { items, total };
	}
}
