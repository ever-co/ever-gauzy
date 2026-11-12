import { Injectable } from '@nestjs/common';
import { ID, TaskAutomationRunOutcomeEnum, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repository the entity names (the services run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmTaskAutomationRunRepository extends MikroOrmBaseEntityRepository<TaskAutomationRun> {}

/**
 * `task_automation_run` (spec FR-14, plan §3): one evaluation of one rule for one task and one change (or due date).
 * The pair `(ruleId, eventKey)` is unique: it is what makes a rule run at most once per change however often the
 * change is delivered. A run is written `RUNNING` when it is claimed and gets its outcome when it ends; `details` is
 * JSON text (the changes, the conditions, a note). `taskId` has no foreign key: a run outlives its task.
 */
@MultiORMEntity('task_automation_run', { mikroOrmRepository: () => MikroOrmTaskAutomationRunRepository })
export class TaskAutomationRun extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	ruleId!: ID;

	@MultiORMColumn({ nullable: true })
	taskId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 160 })
	eventKey!: string;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	triggerType!: TaskAutomationTriggerEnum;

	@MultiORMColumn({ type: 'varchar', length: 24 })
	outcome!: TaskAutomationRunOutcomeEnum;

	@MultiORMColumn({ type: 'int', default: 0 })
	depth!: number;

	@MultiORMColumn({ type: 'text', nullable: true })
	details?: string | null;

	@MultiORMColumn({ type: 'text', nullable: true })
	error?: string | null;

	@MultiORMColumn({ type: 'int', nullable: true })
	durationMs?: number | null;
}
