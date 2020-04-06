import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { TimeLog } from './time-log.entity';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {
		super(timeLogRepository);
	}
}
