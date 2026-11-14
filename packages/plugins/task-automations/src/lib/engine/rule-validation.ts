import {
	ID,
	ITaskAutomationAction,
	ITaskAutomationCondition,
	ITaskAutomationTrigger,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';

/** A rule that cannot be saved; answered as `400` with the reason. */
export class TaskAutomationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TaskAutomationValidationError';
	}
}

/** The ids a rule names, for the service to check against the organization. */
export interface ITaskAutomationRuleReferences {
	/** Status values or ids (triggers, conditions, `SET_STATUS`). */
	statuses: string[];
	/** Priority values or ids (`PRIORITY_IS`, `SET_PRIORITY`). */
	priorities: string[];
	employeeIds: ID[];
	tagIds: ID[];
}

const has = <T extends string>(values: Record<string, T>, value: unknown): value is T =>
	(Object.values(values) as string[]).includes(String(value));

function cleanList(list: unknown, what: string): string[] {
	if (list === undefined || list === null) return [];
	if (!Array.isArray(list)) throw new TaskAutomationValidationError(`${what} must be a list.`);
	const values = [...new Set(list.map((item) => String(item ?? '').trim()).filter(Boolean))];
	if (values.length > TASK_AUTOMATION_LIMITS.valuesPerList) {
		throw new TaskAutomationValidationError(`${what} takes at most ${TASK_AUTOMATION_LIMITS.valuesPerList} values.`);
	}
	for (const value of values) {
		if (value.length > 128) throw new TaskAutomationValidationError(`${what} has a value longer than 128 characters.`);
	}
	return values;
}

/**
 * The trigger as it is stored: its type and, for `STATUS_CHANGED` only, its status lists; for `LINK_CLOSED` only,
 * whether it waits for a merge (`mergedOnly`: absent reads as `false`; `null` and anything but `true` / `false` are
 * refused with `400`).
 */
export function normalizeTrigger(trigger: unknown): ITaskAutomationTrigger {
	const value = (trigger ?? {}) as Partial<ITaskAutomationTrigger>;
	if (!has(TaskAutomationTriggerEnum, value.type)) {
		throw new TaskAutomationValidationError('The trigger is not one the platform knows.');
	}
	if (value.type === TaskAutomationTriggerEnum.LINK_CLOSED) {
		if (value.mergedOnly !== undefined && typeof value.mergedOnly !== 'boolean') {
			throw new TaskAutomationValidationError('The trigger’s “merged only” must be true or false.');
		}
		return { type: value.type, mergedOnly: value.mergedOnly === true };
	}
	if (value.type !== TaskAutomationTriggerEnum.STATUS_CHANGED) {
		return { type: value.type };
	}
	return {
		type: value.type,
		toStatuses: cleanList(value.toStatuses, 'The trigger’s new statuses'),
		fromStatuses: cleanList(value.fromStatuses, 'The trigger’s previous statuses')
	};
}

/** The conditions as they are stored: known types, each with the value it needs and nothing else. */
export function normalizeConditions(conditions: unknown): ITaskAutomationCondition[] {
	if (conditions === undefined || conditions === null) return [];
	if (!Array.isArray(conditions)) throw new TaskAutomationValidationError('The conditions must be a list.');
	if (conditions.length > TASK_AUTOMATION_LIMITS.conditionsPerRule) {
		throw new TaskAutomationValidationError(`A rule takes at most ${TASK_AUTOMATION_LIMITS.conditionsPerRule} conditions.`);
	}
	return conditions.map((raw, index) => {
		const condition = (raw ?? {}) as Partial<ITaskAutomationCondition>;
		const label = `Condition ${index + 1}`;
		if (!has(TaskAutomationConditionEnum, condition.type)) {
			throw new TaskAutomationValidationError(`${label} is not one the platform knows.`);
		}
		switch (condition.type) {
			case TaskAutomationConditionEnum.STATUS_IS:
			case TaskAutomationConditionEnum.STATUS_IS_NOT:
			case TaskAutomationConditionEnum.PRIORITY_IS:
			case TaskAutomationConditionEnum.HAS_LABEL:
			case TaskAutomationConditionEnum.NOT_HAS_LABEL:
			case TaskAutomationConditionEnum.ASSIGNEE_IS: {
				const values = cleanList(condition.values, label);
				if (!values.length) throw new TaskAutomationValidationError(`${label} needs at least one value.`);
				return { type: condition.type, values };
			}
			case TaskAutomationConditionEnum.STATUS_CATEGORY_IS: {
				const values = cleanList(condition.values, label);
				if (!values.length || values.some((value) => !has(TaskAutomationStatusCategoryEnum, value))) {
					throw new TaskAutomationValidationError(`${label} needs one or more of: todo, in_progress, done.`);
				}
				return { type: condition.type, values };
			}
			case TaskAutomationConditionEnum.TITLE_CONTAINS: {
				const text = String(condition.text ?? '').trim();
				if (!text) throw new TaskAutomationValidationError(`${label} needs a text.`);
				if (text.length > TASK_AUTOMATION_LIMITS.textLength) {
					throw new TaskAutomationValidationError(`${label}’s text is longer than ${TASK_AUTOMATION_LIMITS.textLength} characters.`);
				}
				return { type: condition.type, text };
			}
			default:
				return { type: condition.type };
		}
	});
}

/** The actions as they are stored: known types, each with what it sets; at least one. */
export function normalizeActions(actions: unknown): ITaskAutomationAction[] {
	if (!Array.isArray(actions) || actions.length === 0) {
		throw new TaskAutomationValidationError('A rule needs at least one action.');
	}
	if (actions.length > TASK_AUTOMATION_LIMITS.actionsPerRule) {
		throw new TaskAutomationValidationError(`A rule takes at most ${TASK_AUTOMATION_LIMITS.actionsPerRule} actions.`);
	}
	return actions.map((raw, index) => {
		const action = (raw ?? {}) as Partial<ITaskAutomationAction>;
		const label = `Action ${index + 1}`;
		if (!has(TaskAutomationActionEnum, action.type)) {
			throw new TaskAutomationValidationError(`${label} is not one the platform knows.`);
		}
		switch (action.type) {
			case TaskAutomationActionEnum.SET_STATUS: {
				if (action.category !== undefined && action.category !== null && String(action.category) !== '') {
					if (!has(TaskAutomationStatusCategoryEnum, action.category)) {
						throw new TaskAutomationValidationError(`${label}’s category must be todo, in_progress or done.`);
					}
					return { type: action.type, category: action.category };
				}
				const status = String(action.status ?? '').trim();
				if (!status) throw new TaskAutomationValidationError(`${label} needs a status or a category.`);
				return { type: action.type, status };
			}
			case TaskAutomationActionEnum.SET_PRIORITY: {
				const priority = String(action.priority ?? '').trim();
				if (!priority) throw new TaskAutomationValidationError(`${label} needs a priority.`);
				return { type: action.type, priority };
			}
			case TaskAutomationActionEnum.ADD_ASSIGNEES: {
				const employeeIds = cleanList(action.employeeIds, label);
				if (!employeeIds.length) throw new TaskAutomationValidationError(`${label} needs at least one person.`);
				return { type: action.type, employeeIds };
			}
			case TaskAutomationActionEnum.SET_ASSIGNEES:
				// An empty list is allowed: it unassigns everyone. A missing list is not read as one.
				if (!Array.isArray(action.employeeIds)) {
					throw new TaskAutomationValidationError(`${label} needs the people to assign (an empty list unassigns everyone).`);
				}
				return { type: action.type, employeeIds: cleanList(action.employeeIds, label) };
			case TaskAutomationActionEnum.ADD_LABELS:
			case TaskAutomationActionEnum.REMOVE_LABELS: {
				const tagIds = cleanList(action.tagIds, label);
				if (!tagIds.length) throw new TaskAutomationValidationError(`${label} needs at least one label.`);
				return { type: action.type, tagIds };
			}
			case TaskAutomationActionEnum.NOTIFY_ASSIGNEES: {
				const message = String(action.message ?? '').trim();
				if (message.length > TASK_AUTOMATION_LIMITS.messageLength) {
					throw new TaskAutomationValidationError(`${label}’s message is longer than ${TASK_AUTOMATION_LIMITS.messageLength} characters.`);
				}
				return message ? { type: action.type, message } : { type: action.type };
			}
			default:
				return { type: action.type };
		}
	});
}

/** A rule's name: required, trimmed, at most the limit. */
export function normalizeName(name: unknown): string {
	const value = String(name ?? '').trim();
	if (!value) throw new TaskAutomationValidationError('A rule needs a name.');
	if (value.length > TASK_AUTOMATION_LIMITS.nameLength) {
		throw new TaskAutomationValidationError(`A rule’s name is at most ${TASK_AUTOMATION_LIMITS.nameLength} characters.`);
	}
	return value;
}

/** A rule's description: optional, trimmed, at most the limit. */
export function normalizeDescription(description: unknown): string | null {
	const value = String(description ?? '').trim();
	if (value.length > TASK_AUTOMATION_LIMITS.descriptionLength) {
		throw new TaskAutomationValidationError(`A rule’s description is at most ${TASK_AUTOMATION_LIMITS.descriptionLength} characters.`);
	}
	return value || null;
}

/** The statuses, priorities, people and labels a rule names. */
export function referencesOf(rule: {
	trigger: ITaskAutomationTrigger;
	conditions: ITaskAutomationCondition[];
	actions: ITaskAutomationAction[];
}): ITaskAutomationRuleReferences {
	const statuses = new Set<string>([...(rule.trigger.toStatuses ?? []), ...(rule.trigger.fromStatuses ?? [])]);
	const priorities = new Set<string>();
	const employeeIds = new Set<string>();
	const tagIds = new Set<string>();
	for (const condition of rule.conditions) {
		const values = condition.values ?? [];
		if (condition.type === TaskAutomationConditionEnum.STATUS_IS || condition.type === TaskAutomationConditionEnum.STATUS_IS_NOT) {
			values.forEach((value) => statuses.add(value));
		} else if (condition.type === TaskAutomationConditionEnum.PRIORITY_IS) {
			values.forEach((value) => priorities.add(value));
		} else if (condition.type === TaskAutomationConditionEnum.ASSIGNEE_IS) {
			values.forEach((value) => employeeIds.add(value));
		} else if (condition.type === TaskAutomationConditionEnum.HAS_LABEL || condition.type === TaskAutomationConditionEnum.NOT_HAS_LABEL) {
			values.forEach((value) => tagIds.add(value));
		}
	}
	for (const action of rule.actions) {
		if (action.status) statuses.add(action.status);
		if (action.priority) priorities.add(action.priority);
		(action.employeeIds ?? []).forEach((id) => employeeIds.add(id));
		(action.tagIds ?? []).forEach((id) => tagIds.add(id));
	}
	return { statuses: [...statuses], priorities: [...priorities], employeeIds: [...employeeIds], tagIds: [...tagIds] };
}
