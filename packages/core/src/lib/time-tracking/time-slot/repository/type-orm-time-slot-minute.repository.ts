import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotMinute } from '../time-slot-minute.entity';

@Injectable()
export class TypeOrmTimeSlotMinuteRepository extends Repository<TimeSlotMinute> {
	constructor(@InjectRepository(TimeSlotMinute) readonly repository: Repository<TimeSlotMinute>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
