import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../task.entity';

@Injectable()
export class TypeOrmTaskRepository extends Repository<Task> {
	constructor(@InjectRepository(Task) readonly repository: Repository<Task>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
