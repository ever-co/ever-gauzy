import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobExecution } from '../job-execution.entity';

@Injectable()
export class TypeOrmJobExecutionRepository extends Repository<JobExecution> {
	constructor(@InjectRepository(JobExecution) readonly repository: Repository<JobExecution>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
