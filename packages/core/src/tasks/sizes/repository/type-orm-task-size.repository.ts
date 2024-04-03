import { Repository } from 'typeorm';
import { TaskSize } from '../size.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TypeOrmTaskSizeRepository extends Repository<TaskSize> {
	constructor(@InjectRepository(TaskSize) readonly repository: Repository<TaskSize>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
