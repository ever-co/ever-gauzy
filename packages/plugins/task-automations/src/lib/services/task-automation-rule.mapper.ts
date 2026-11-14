import {
	ITaskAutomationAction,
	ITaskAutomationCondition,
	ITaskAutomationRule,
	ITaskAutomationRun,
	ITaskAutomationTrigger,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { TaskAutomationRule } from '../entities/task-automation-rule.entity';
import { TaskAutomationRun } from '../entities/task-automation-run.entity';

/** JSON text back to a value; a damaged column reads as the fallback rather than failing the whole list. */
export function parseJson<T>(text: string | null | undefined, fallback: T): T {
	if (text === null || text === undefined || text === '') return fallback;
	if (typeof text !== 'string') return text as unknown as T;
	try {
		return JSON.parse(text) as T;
	} catch {
		return fallback;
	}
}

/** A stored rule as the API answers it. */
export function ruleFromRow(row: TaskAutomationRule): ITaskAutomationRule {
	const config = parseJson<Partial<ITaskAutomationTrigger>>(row.triggerConfig, {});
	const trigger: ITaskAutomationTrigger = { type: row.triggerType as TaskAutomationTriggerEnum };
	if (row.triggerType === TaskAutomationTriggerEnum.STATUS_CHANGED) {
		trigger.toStatuses = Array.isArray(config.toStatuses) ? config.toStatuses.map(String) : [];
		trigger.fromStatuses = Array.isArray(config.fromStatuses) ? config.fromStatuses.map(String) : [];
	} else if (row.triggerType === TaskAutomationTriggerEnum.LINK_CLOSED) {
		// A rule saved before the option has no settings: any close, as it always ran.
		trigger.mergedOnly = config?.mergedOnly === true;
	}
	const conditions = parseJson<ITaskAutomationCondition[]>(row.conditions, []);
	const actions = parseJson<ITaskAutomationAction[]>(row.actions, []);
	return {
		id: row.id,
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		name: row.name,
		description: row.description ?? null,
		projectId: row.projectId ?? null,
		organizationTeamId: row.organizationTeamId ?? null,
		isEnabled: row.isEnabled === true || Number(row.isEnabled) === 1,
		position: Number(row.position ?? 0),
		templateKey: row.templateKey ?? null,
		trigger,
		conditions: Array.isArray(conditions) ? conditions : [],
		actions: Array.isArray(actions) ? actions : [],
		lastRunAt: row.lastRunAt ?? null,
		createdByUserId: row.createdByUserId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	} as ITaskAutomationRule;
}

/**
 * The columns a rule's trigger, conditions and actions are stored in. A `LINK_CLOSED` trigger keeps settings only when
 * it waits for a merge, so a rule without the option is stored as before it existed.
 */
export function ruleColumns(rule: Pick<ITaskAutomationRule, 'trigger' | 'conditions' | 'actions'>) {
	const config =
		rule.trigger.type === TaskAutomationTriggerEnum.STATUS_CHANGED
			? JSON.stringify({ toStatuses: rule.trigger.toStatuses ?? [], fromStatuses: rule.trigger.fromStatuses ?? [] })
			: rule.trigger.type === TaskAutomationTriggerEnum.LINK_CLOSED && rule.trigger.mergedOnly === true
				? JSON.stringify({ mergedOnly: true })
				: null;
	return {
		triggerType: rule.trigger.type,
		triggerConfig: config,
		conditions: JSON.stringify(rule.conditions ?? []),
		actions: JSON.stringify(rule.actions ?? [])
	};
}

/** A stored run as the API answers it. */
export function runFromRow(row: TaskAutomationRun): ITaskAutomationRun {
	return {
		id: row.id,
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		ruleId: row.ruleId,
		taskId: row.taskId ?? null,
		eventKey: row.eventKey,
		triggerType: row.triggerType,
		outcome: row.outcome,
		depth: Number(row.depth ?? 0),
		details: parseJson(row.details, null),
		error: row.error ?? null,
		durationMs: row.durationMs ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	} as ITaskAutomationRun;
}
