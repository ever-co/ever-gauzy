import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { SimWorkflowExecution } from './sim-workflow-execution.entity';
import { TypeOrmSimWorkflowExecutionRepository } from './repository/type-orm-sim-workflow-execution.repository';
import { MikroOrmSimWorkflowExecutionRepository } from './repository/mikro-orm-sim-workflow-execution.repository';

@Injectable()
export class SimRepositoryService extends TenantAwareCrudService<SimWorkflowExecution> {
	constructor(
		readonly typeOrmSimWorkflowExecutionRepository: TypeOrmSimWorkflowExecutionRepository,
		readonly mikroOrmSimWorkflowExecutionRepository: MikroOrmSimWorkflowExecutionRepository
	) {
		super(typeOrmSimWorkflowExecutionRepository, mikroOrmSimWorkflowExecutionRepository);
	}
}
