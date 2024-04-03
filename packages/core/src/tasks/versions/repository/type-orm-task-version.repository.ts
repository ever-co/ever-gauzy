import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskVersion } from '../version.entity';

@Injectable()
export class TypeOrmTaskVersionRepository extends Repository<TaskVersion> {
	constructor(@InjectRepository(TaskVersion) readonly repository: Repository<TaskVersion>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
