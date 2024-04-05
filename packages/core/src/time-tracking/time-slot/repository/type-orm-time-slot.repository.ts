import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlot } from '../time-slot.entity';

@Injectable()
export class TypeOrmTimeSlotRepository extends Repository<TimeSlot> {
	constructor(@InjectRepository(TimeSlot) readonly repository: Repository<TimeSlot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
