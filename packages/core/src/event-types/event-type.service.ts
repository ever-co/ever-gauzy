import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination } from '@gauzy/contracts';
import { Repository, FindManyOptions } from 'typeorm';
import { EventType } from './event-type.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class EventTypeService extends TenantAwareCrudService<EventType> {
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
