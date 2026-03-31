import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { SimWorkflowExecution } from '../sim-workflow-execution.entity';

export class MikroOrmSimWorkflowExecutionRepository extends MikroOrmBaseEntityRepository<SimWorkflowExecution> { }
