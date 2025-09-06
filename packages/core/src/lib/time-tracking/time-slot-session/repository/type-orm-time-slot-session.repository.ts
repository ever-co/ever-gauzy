import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotSession } from '../time-slot-session.entity';

@Injectable()
export class TypeOrmTimeSlotSessionRepository extends Repository<TimeSlotSession> {
	constructor(@InjectRepository(TimeSlotSession) readonly repository: Repository<TimeSlotSession>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
