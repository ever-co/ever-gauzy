import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventDelivery } from '../event-delivery.entity';

@Injectable()
export class TypeOrmEventDeliveryRepository extends Repository<EventDelivery> {
	constructor(@InjectRepository(EventDelivery) readonly repository: Repository<EventDelivery>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
