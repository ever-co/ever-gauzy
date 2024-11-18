import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskView } from '../view.entity';

@Injectable()
export class TypeOrmTaskViewRepository extends Repository<TaskView> {
	constructor(@InjectRepository(TaskView) readonly repository: Repository<TaskView>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
