import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskStatus } from '../status.entity';

@Injectable()
export class TypeOrmTaskStatusRepository extends Repository<TaskStatus> {
	// constructor(@InjectRepository(TaskStatus) readonly repository: Repository<TaskStatus>) {
	// 	super(repository.target, repository.manager, repository.queryRunner);
	// }
}
