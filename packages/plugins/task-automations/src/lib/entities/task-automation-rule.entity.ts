import { Injectable } from '@nestjs/common';
import { ID, TaskAutomationTriggerEnum } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repository the entity names (the services run on TypeORM's `DataSource`, as the Inbox's do). */
@Injectable()
export class MikroOrmTaskAutomationRuleRepository extends MikroOrmBaseEntityRepository<TaskAutomationRule> {}

/**
 * `task_automation_rule` (spec §5, plan §3): one automation rule of an organization — a trigger, conditions and
 * actions, optionally narrowed to a project or a team, on or off, at a position. The trigger's settings, the
 * conditions and the actions are JSON text (one code path for every dialect and both ORMs); `TaskAutomationRuleService`
 * reads and writes them through `ruleFromRow` / `rowFromRule`. Created by the plugin's migration, registered only with
 * the plugin (`GAUZY_TASK_AUTOMATIONS_ENABLED`).
 */
@MultiORMEntity('task_automation_rule', { mikroOrmRepository: () => MikroOrmTaskAutomationRuleRepository })
export class TaskAutomationRule extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 120 })
	name!: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string | null;

	@MultiORMColumn({ nullable: true })
	projectId?: ID;

	@MultiORMColumn({ nullable: true })
	organizationTeamId?: ID;

	@MultiORMColumn({ type: 'boolean', default: false })
	isEnabled!: boolean;

	@MultiORMColumn({ type: 'int', default: 0 })
	position!: number;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	templateKey?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	triggerType!: TaskAutomationTriggerEnum;

	/** JSON: the trigger's settings (`toStatuses`, `fromStatuses`; `mergedOnly`). */
	@MultiORMColumn({ type: 'text', nullable: true })
	triggerConfig?: string | null;

	/** JSON: the conditions. */
	@MultiORMColumn({ type: 'text', nullable: true })
	conditions?: string | null;

	/** JSON: the actions. */
	@MultiORMColumn({ type: 'text', nullable: true })
	actions?: string | null;

	@MultiORMColumn({ nullable: true })
	lastRunAt?: Date;
}
