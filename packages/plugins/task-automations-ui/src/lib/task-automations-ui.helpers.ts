import { HttpErrorResponse } from '@angular/common/http';
import {
	ID,
	ITaskAutomationAction,
	ITaskAutomationCondition,
	ITaskAutomationRule,
	ITaskAutomationRuleCreateInput,
	ITaskAutomationTemplate,
	ITaskAutomationTrigger,
	TASK_AUTOMATION_LIMITS,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';

/** What the page shows. */
export type TaskAutomationsView = 'loading' | 'ready' | 'unavailable' | 'forbidden' | 'error';

/** The view an API failure of the page's first load leads to: 404 = the feature is off; 403 = not for me. */
export function viewOfLoadError(error: unknown): TaskAutomationsView {
	const status = (error as HttpErrorResponse)?.status;
	if (status === 404) return 'unavailable';
	if (status === 403 || status === 401) return 'forbidden';
	return 'error';
}

/** The message of an API refusal (`message` of the Nest error body, joined when it is a list), or `null`. */
export function apiErrorMessage(error: unknown): string | null {
	const body = (error as HttpErrorResponse)?.error;
	const message = body?.message ?? null;
	if (Array.isArray(message)) return message.filter((part) => typeof part === 'string').join(' ') || null;
	return typeof message === 'string' && message.trim() ? message.trim() : null;
}

/** The triggers, conditions, actions and categories the editor offers, in the order it offers them. */
export const TRIGGER_TYPES: readonly TaskAutomationTriggerEnum[] = Object.values(TaskAutomationTriggerEnum);
export const CONDITION_TYPES: readonly TaskAutomationConditionEnum[] = Object.values(TaskAutomationConditionEnum);
export const ACTION_TYPES: readonly TaskAutomationActionEnum[] = Object.values(TaskAutomationActionEnum);
export const STATUS_CATEGORIES: readonly TaskAutomationStatusCategoryEnum[] = Object.values(TaskAutomationStatusCategoryEnum);

/** What a condition compares with: which picker the editor shows for it. */
export type ConditionInput = 'statuses' | 'categories' | 'priorities' | 'tags' | 'employees' | 'text' | null;

export function conditionInput(type: TaskAutomationConditionEnum): ConditionInput {
	switch (type) {
		case TaskAutomationConditionEnum.STATUS_IS:
		case TaskAutomationConditionEnum.STATUS_IS_NOT:
			return 'statuses';
		case TaskAutomationConditionEnum.STATUS_CATEGORY_IS:
			return 'categories';
		case TaskAutomationConditionEnum.PRIORITY_IS:
			return 'priorities';
		case TaskAutomationConditionEnum.HAS_LABEL:
		case TaskAutomationConditionEnum.NOT_HAS_LABEL:
			return 'tags';
		case TaskAutomationConditionEnum.ASSIGNEE_IS:
			return 'employees';
		case TaskAutomationConditionEnum.TITLE_CONTAINS:
			return 'text';
		default:
			return null;
	}
}

/** What an action sets: which picker the editor shows for it. */
export type ActionInput = 'status' | 'priority' | 'employees' | 'tags' | 'message';

export function actionInput(type: TaskAutomationActionEnum): ActionInput {
	switch (type) {
		case TaskAutomationActionEnum.SET_STATUS:
			return 'status';
		case TaskAutomationActionEnum.SET_PRIORITY:
			return 'priority';
		case TaskAutomationActionEnum.ADD_ASSIGNEES:
		case TaskAutomationActionEnum.SET_ASSIGNEES:
			return 'employees';
		case TaskAutomationActionEnum.ADD_LABELS:
		case TaskAutomationActionEnum.REMOVE_LABELS:
			return 'tags';
		default:
			return 'message';
	}
}

/** A condition as the editor holds it: every field present, the type deciding which counts. */
export interface ITaskAutomationConditionDraft {
	type: TaskAutomationConditionEnum;
	values: string[];
	text: string;
}

/**
 * An action as the editor holds it. `statusMode` says whether `SET_STATUS` names a status or a category (the first
 * status of that category of the task's project).
 */
export interface ITaskAutomationActionDraft {
	type: TaskAutomationActionEnum;
	statusMode: 'category' | 'status';
	status: string;
	category: TaskAutomationStatusCategoryEnum;
	priority: string;
	employeeIds: string[];
	tagIds: string[];
	message: string;
}

/** A rule as the editor holds it. */
export interface ITaskAutomationDraft {
	id: ID | null;
	templateKey: string | null;
	name: string;
	description: string;
	projectId: string | null;
	organizationTeamId: string | null;
	isEnabled: boolean;
	/** `mergedOnly`: a linked pull request fires the link trigger only when merged (`LINK_CLOSED` only). */
	trigger: { type: TaskAutomationTriggerEnum; toStatuses: string[]; fromStatuses: string[]; mergedOnly: boolean };
	conditions: ITaskAutomationConditionDraft[];
	actions: ITaskAutomationActionDraft[];
}

const strings = (values: readonly unknown[] | null | undefined): string[] =>
	[...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))];

/** A new condition of a type, empty. */
export function newCondition(type: TaskAutomationConditionEnum = TaskAutomationConditionEnum.IS_OPEN): ITaskAutomationConditionDraft {
	return { type, values: [], text: '' };
}

/** A new action of a type, empty (`SET_STATUS` starts on the done category). */
export function newAction(type: TaskAutomationActionEnum = TaskAutomationActionEnum.SET_STATUS): ITaskAutomationActionDraft {
	return {
		type,
		statusMode: 'category',
		status: '',
		category: TaskAutomationStatusCategoryEnum.DONE,
		priority: '',
		employeeIds: [],
		tagIds: [],
		message: ''
	};
}

function conditionDraft(condition: ITaskAutomationCondition): ITaskAutomationConditionDraft {
	return { type: condition.type, values: strings(condition.values), text: condition.text ?? '' };
}

function actionDraft(action: ITaskAutomationAction): ITaskAutomationActionDraft {
	return {
		...newAction(action.type),
		statusMode: action.status ? 'status' : 'category',
		status: action.status ?? '',
		category: action.category ?? TaskAutomationStatusCategoryEnum.DONE,
		priority: action.priority ?? '',
		employeeIds: strings(action.employeeIds),
		tagIds: strings(action.tagIds),
		message: action.message ?? ''
	};
}

function triggerDraft(trigger: ITaskAutomationTrigger | null | undefined): ITaskAutomationDraft['trigger'] {
	return {
		type: trigger?.type ?? TaskAutomationTriggerEnum.STATUS_CHANGED,
		toStatuses: strings(trigger?.toStatuses),
		fromStatuses: strings(trigger?.fromStatuses),
		mergedOnly: trigger?.mergedOnly === true
	};
}

/** A blank rule: a status change, no condition, one action. */
export function blankDraft(): ITaskAutomationDraft {
	return {
		id: null,
		templateKey: null,
		name: '',
		description: '',
		projectId: null,
		organizationTeamId: null,
		isEnabled: true,
		trigger: triggerDraft(null),
		conditions: [],
		actions: [newAction()]
	};
}

/** A new rule from a template (switched off when the template needs the organization's values). */
export function draftOfTemplate(template: ITaskAutomationTemplate, name?: string): ITaskAutomationDraft {
	return {
		...blankDraft(),
		templateKey: template.key,
		name: (name ?? template.name).slice(0, TASK_AUTOMATION_LIMITS.nameLength),
		description: template.description ?? '',
		isEnabled: !template.needsInput,
		trigger: triggerDraft(template.trigger),
		conditions: (template.conditions ?? []).map(conditionDraft),
		actions: (template.actions ?? []).map(actionDraft)
	};
}

/** A saved rule, to edit. */
export function draftOfRule(rule: ITaskAutomationRule): ITaskAutomationDraft {
	return {
		id: (rule.id as ID) ?? null,
		templateKey: rule.templateKey ?? null,
		name: rule.name ?? '',
		description: rule.description ?? '',
		projectId: rule.projectId ?? null,
		organizationTeamId: rule.organizationTeamId ?? null,
		isEnabled: !!rule.isEnabled,
		trigger: triggerDraft(rule.trigger),
		conditions: (rule.conditions ?? []).map(conditionDraft),
		actions: (rule.actions ?? []).map(actionDraft)
	};
}

/** A condition as the API stores it: its type and the one value it uses. */
export function conditionOfDraft(draft: ITaskAutomationConditionDraft): ITaskAutomationCondition {
	const input = conditionInput(draft.type);
	if (input === 'text') return { type: draft.type, text: draft.text.trim() };
	if (input) return { type: draft.type, values: strings(draft.values) };
	return { type: draft.type };
}

/** An action as the API stores it: its type and what it sets. */
export function actionOfDraft(draft: ITaskAutomationActionDraft): ITaskAutomationAction {
	switch (actionInput(draft.type)) {
		case 'status':
			return draft.statusMode === 'status' ? { type: draft.type, status: draft.status.trim() } : { type: draft.type, category: draft.category };
		case 'priority':
			return { type: draft.type, priority: draft.priority.trim() };
		case 'employees':
			return { type: draft.type, employeeIds: strings(draft.employeeIds) };
		case 'tags':
			return { type: draft.type, tagIds: strings(draft.tagIds) };
		default: {
			const message = draft.message.trim();
			return message ? { type: draft.type, message } : { type: draft.type };
		}
	}
}

/**
 * What saving the editor sends: the rule's fields, the trigger's status lists only for a status change, "merged only"
 * only for a closed link.
 */
export function ruleInputOfDraft(draft: ITaskAutomationDraft): ITaskAutomationRuleCreateInput {
	const trigger: ITaskAutomationTrigger =
		draft.trigger.type === TaskAutomationTriggerEnum.STATUS_CHANGED
			? { type: draft.trigger.type, toStatuses: strings(draft.trigger.toStatuses), fromStatuses: strings(draft.trigger.fromStatuses) }
			: draft.trigger.type === TaskAutomationTriggerEnum.LINK_CLOSED
				? { type: draft.trigger.type, mergedOnly: draft.trigger.mergedOnly === true }
				: { type: draft.trigger.type };
	return {
		name: draft.name.trim(),
		description: draft.description.trim() || null,
		projectId: draft.projectId || null,
		organizationTeamId: draft.organizationTeamId || null,
		isEnabled: draft.isEnabled,
		trigger,
		conditions: draft.conditions.map(conditionOfDraft),
		actions: draft.actions.map(actionOfDraft)
	};
}

/**
 * What keeps the editor from saving, as translation keys of the plugin's namespace (the API checks the same and
 * more — that what a rule names is the organization's — and its refusal is shown as it answers).
 */
export function draftErrors(draft: ITaskAutomationDraft): string[] {
	const errors: string[] = [];
	const name = draft.name.trim();
	if (!name) errors.push('TASK_AUTOMATIONS.ERRORS.NAME_REQUIRED');
	else if (name.length > TASK_AUTOMATION_LIMITS.nameLength) errors.push('TASK_AUTOMATIONS.ERRORS.NAME_TOO_LONG');
	if (draft.description.trim().length > TASK_AUTOMATION_LIMITS.descriptionLength) errors.push('TASK_AUTOMATIONS.ERRORS.DESCRIPTION_TOO_LONG');
	if (draft.conditions.length > TASK_AUTOMATION_LIMITS.conditionsPerRule) errors.push('TASK_AUTOMATIONS.ERRORS.TOO_MANY_CONDITIONS');
	if (!draft.actions.length) errors.push('TASK_AUTOMATIONS.ERRORS.ACTION_REQUIRED');
	if (draft.actions.length > TASK_AUTOMATION_LIMITS.actionsPerRule) errors.push('TASK_AUTOMATIONS.ERRORS.TOO_MANY_ACTIONS');
	for (const condition of draft.conditions) {
		const input = conditionInput(condition.type);
		if (input === 'text' ? !condition.text.trim() : input && !strings(condition.values).length) {
			errors.push('TASK_AUTOMATIONS.ERRORS.CONDITION_VALUE');
			break;
		}
	}
	if (draft.conditions.some((condition) => condition.text.trim().length > TASK_AUTOMATION_LIMITS.textLength)) {
		errors.push('TASK_AUTOMATIONS.ERRORS.TEXT_TOO_LONG');
	}
	const tooMany = (values: readonly string[] | null | undefined) => strings(values ?? []).length > TASK_AUTOMATION_LIMITS.valuesPerList;
	// The status lists count only for a status change: another trigger neither shows nor sends them.
	const statusTrigger = draft.trigger.type === TaskAutomationTriggerEnum.STATUS_CHANGED;
	if (
		(statusTrigger && (tooMany(draft.trigger.toStatuses) || tooMany(draft.trigger.fromStatuses))) ||
		draft.conditions.some((condition) => tooMany(condition.values)) ||
		draft.actions.some((action) => tooMany(action.employeeIds) || tooMany(action.tagIds))
	) {
		errors.push('TASK_AUTOMATIONS.ERRORS.TOO_MANY_VALUES');
	}
	for (const action of draft.actions) {
		const input = actionInput(action.type);
		const missing =
			(input === 'status' && action.statusMode === 'status' && !action.status.trim()) ||
			(input === 'priority' && !action.priority.trim()) ||
			(action.type === TaskAutomationActionEnum.ADD_ASSIGNEES && !strings(action.employeeIds).length) ||
			(input === 'tags' && !strings(action.tagIds).length) ||
			(input === 'message' && action.message.trim().length > TASK_AUTOMATION_LIMITS.messageLength);
		if (missing) {
			errors.push('TASK_AUTOMATIONS.ERRORS.ACTION_VALUE');
			break;
		}
	}
	return errors;
}

/** The ids in a new order: the rule at `index` moved by `delta` (−1 up, +1 down); the same order at an edge. */
export function movedOrder(ids: readonly ID[], index: number, delta: number): ID[] {
	const next = [...ids];
	const target = index + delta;
	if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

/** The ids in a new order: the rule dragged from `from` dropped at `to`. */
/**
 * What an edit changed: the fields of `after` that differ from `before` (both as the API takes them), so an update
 * writes only those. Creating a rule sends the whole input instead.
 */
export function changedRuleInput(
	before: ITaskAutomationRuleCreateInput,
	after: ITaskAutomationRuleCreateInput
): Partial<ITaskAutomationRuleCreateInput> {
	const changed: Partial<ITaskAutomationRuleCreateInput> = {};
	for (const key of Object.keys(after) as Array<keyof ITaskAutomationRuleCreateInput>) {
		if (JSON.stringify(after[key] ?? null) !== JSON.stringify(before[key] ?? null)) {
			(changed as Record<string, unknown>)[key] = after[key];
		}
	}
	return changed;
}

/**
 * The rules in an order: the ids named first, in their order, then the others as they were; each rule as it is now, its
 * position its place. A rule no longer in the list is not brought back, a new one is kept.
 */
export function rulesInOrder(rules: readonly ITaskAutomationRule[], ids: readonly ID[]): ITaskAutomationRule[] {
	const byId = new Map(rules.map((rule) => [rule.id as ID, rule]));
	const named = ids.map((id) => byId.get(id)).filter((rule): rule is ITaskAutomationRule => !!rule);
	const rest = rules.filter((rule) => !ids.includes(rule.id as ID));
	return [...named, ...rest].map((rule, position) => ({ ...rule, position }));
}

export function droppedOrder(ids: readonly ID[], from: number, to: number): ID[] {
	const next = [...ids];
	if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

/** The Nebular status a run's outcome is shown with. */
export function outcomeStatus(outcome: TaskAutomationRunOutcomeEnum | string | null | undefined): 'success' | 'info' | 'warning' | 'danger' | 'basic' {
	switch (outcome) {
		case TaskAutomationRunOutcomeEnum.APPLIED:
			return 'success';
		case TaskAutomationRunOutcomeEnum.PARTIAL:
		case TaskAutomationRunOutcomeEnum.LOOP_GUARD:
		case TaskAutomationRunOutcomeEnum.RATE_LIMITED:
			return 'warning';
		case TaskAutomationRunOutcomeEnum.FAILED:
			return 'danger';
		case TaskAutomationRunOutcomeEnum.RUNNING:
			return 'info';
		default:
			return 'basic';
	}
}

/** A value of a change line as text: a list joined, a value through the names the page knows. */
export function changeValueText(value: unknown, names: ReadonlyMap<string, string> = new Map()): string {
	if (value === null || value === undefined || value === '') return '—';
	if (Array.isArray(value)) return value.length ? value.map((item) => changeValueText(item, names)).join(', ') : '—';
	const text = String(value);
	return names.get(text) ?? text;
}

/** The translation key of a template's name, falling back to the API's English when the app has none. */
export function templateNameKey(template: Pick<ITaskAutomationTemplate, 'key'>): string {
	return `TASK_AUTOMATIONS.TEMPLATES.${template.key}.NAME`;
}

export function templateDescriptionKey(template: Pick<ITaskAutomationTemplate, 'key'>): string {
	return `TASK_AUTOMATIONS.TEMPLATES.${template.key}.DESCRIPTION`;
}
