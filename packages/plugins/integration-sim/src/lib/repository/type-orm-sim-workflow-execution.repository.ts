import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimWorkflowExecution } from '../sim-workflow-execution.entity';

@Injectable()
export class TypeOrmSimWorkflowExecutionRepository extends Repository<SimWorkflowExecution> {
	constructor(
		@InjectRepository(SimWorkflowExecution) readonly repository: Repository<SimWorkflowExecution>
	) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
