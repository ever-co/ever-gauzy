import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventOutbox } from '../event-outbox.entity';

@Injectable()
export class TypeOrmEventOutboxRepository extends Repository<EventOutbox> {
	constructor(@InjectRepository(EventOutbox) readonly repository: Repository<EventOutbox>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
