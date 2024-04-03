import { Repository } from 'typeorm';
import { TimeSlot } from '../time-slot.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmTimeSlotRepository extends Repository<TimeSlot> {
	constructor(@InjectRepository(TimeSlot) readonly repository: Repository<TimeSlot>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
