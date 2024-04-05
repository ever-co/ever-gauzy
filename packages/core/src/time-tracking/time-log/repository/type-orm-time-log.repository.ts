import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeLog } from '../time-log.entity';

@Injectable()
export class TypeOrmTimeLogRepository extends Repository<TimeLog> {
	constructor(@InjectRepository(TimeLog) readonly repository: Repository<TimeLog>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
