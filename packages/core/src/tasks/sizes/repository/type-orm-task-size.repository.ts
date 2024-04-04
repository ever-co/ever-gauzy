import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskSize } from '../size.entity';

@Injectable()
export class TypeOrmTaskSizeRepository extends Repository<TaskSize> {
	constructor(@InjectRepository(TaskSize) readonly repository: Repository<TaskSize>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
