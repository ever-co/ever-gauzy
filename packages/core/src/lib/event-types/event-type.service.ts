import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEventTypeRepository } from './repository/type-orm-event-types.repository';
import { MikroOrmEventTypeRepository } from './repository/mikro-orm-event-type.repository';
import { EventType } from './event-type.entity';

@Injectable()
export class EventTypeService extends TenantAwareCrudService<EventType> {
	constructor(
		typeOrmEventTypeRepository: TypeOrmEventTypeRepository,
		mikroOrmEventTypeRepository: MikroOrmEventTypeRepository
	) {
		super(typeOrmEventTypeRepository, mikroOrmEventTypeRepository);
	}
}
