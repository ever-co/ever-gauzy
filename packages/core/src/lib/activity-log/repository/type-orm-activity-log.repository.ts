import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../activity-log.entity';

@Injectable()
export class TypeOrmActivityLogRepository extends Repository<ActivityLog> {
	constructor(@InjectRepository(ActivityLog) readonly repository: Repository<ActivityLog>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
