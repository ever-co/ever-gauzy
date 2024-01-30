import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEventTypeRepository } from './repository/type-orm-event-types.repository';
import { MikroOrmEventTypeRepository } from './repository/mikro-orm-event-type.repository';
import { EventType } from './event-type.entity';

@Injectable()
export class EventTypeService extends TenantAwareCrudService<EventType> {
	constructor(
		@InjectRepository(EventType)
		typeOrmEventTypeRepository: TypeOrmEventTypeRepository,

		mikroOrmEventTypeRepository: MikroOrmEventTypeRepository
	) {
		super(typeOrmEventTypeRepository, mikroOrmEventTypeRepository);
	}
}
