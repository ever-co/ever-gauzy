import {
	TASK_AUTOMATION_LIMITS,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import {
	normalizeActions,
	normalizeConditions,
	normalizeDescription,
	normalizeName,
	normalizeTrigger,
	referencesOf,
	TaskAutomationValidationError
} from './rule-validation';
import { TASK_AUTOMATION_TEMPLATES, templateByKey } from './templates';

describe('rule validation', () => {
	it('keeps a trigger’s status lists only on STATUS_CHANGED, deduplicated', () => {
		expect(normalizeTrigger({ type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['done', ' done ', ''] })).toEqual({
			type: TaskAutomationTriggerEnum.STATUS_CHANGED,
			toStatuses: ['done'],
			fromStatuses: []
		});
		expect(normalizeTrigger({ type: TaskAutomationTriggerEnum.TASK_ASSIGNED, toStatuses: ['done'] })).toEqual({
			type: TaskAutomationTriggerEnum.TASK_ASSIGNED
		});
		expect(() => normalizeTrigger({ type: 'WHENEVER' })).toThrow(TaskAutomationValidationError);
		expect(() => normalizeTrigger(undefined)).toThrow(TaskAutomationValidationError);
	});

	it('keeps “merged only” on LINK_CLOSED alone, false when absent, and refuses a value that is not true or false', () => {
		const LINK_CLOSED = TaskAutomationTriggerEnum.LINK_CLOSED;
		expect(normalizeTrigger({ type: LINK_CLOSED, mergedOnly: true })).toEqual({
			type: LINK_CLOSED,
			mergedOnly: true
		});
		expect(normalizeTrigger({ type: LINK_CLOSED, mergedOnly: false })).toEqual({
			type: LINK_CLOSED,
			mergedOnly: false
		});
		expect(normalizeTrigger({ type: LINK_CLOSED })).toEqual({ type: LINK_CLOSED, mergedOnly: false });
		for (const mergedOnly of [null, 'true', 1, {}, []]) {
			expect(() => normalizeTrigger({ type: LINK_CLOSED, mergedOnly })).toThrow(/merged only/);
		}
		// Another trigger keeps no such setting.
		expect(normalizeTrigger({ type: TaskAutomationTriggerEnum.TASK_ASSIGNED, mergedOnly: true })).toEqual({
			type: TaskAutomationTriggerEnum.TASK_ASSIGNED
		});
		expect(
			normalizeTrigger({ type: TaskAutomationTriggerEnum.STATUS_CHANGED, mergedOnly: true })
		).not.toHaveProperty('mergedOnly');
	});

	it('keeps each condition’s value and nothing else, and refuses what is missing', () => {
		expect(
			normalizeConditions([
				{ type: TaskAutomationConditionEnum.STATUS_IS, values: ['open'], text: 'dropped' },
				{ type: TaskAutomationConditionEnum.IS_OPEN, values: ['dropped'] },
				{ type: TaskAutomationConditionEnum.TITLE_CONTAINS, text: ' release ' },
				{ type: TaskAutomationConditionEnum.STATUS_CATEGORY_IS, values: [TaskAutomationStatusCategoryEnum.TODO] }
			])
		).toEqual([
			{ type: TaskAutomationConditionEnum.STATUS_IS, values: ['open'] },
			{ type: TaskAutomationConditionEnum.IS_OPEN },
			{ type: TaskAutomationConditionEnum.TITLE_CONTAINS, text: 'release' },
			{ type: TaskAutomationConditionEnum.STATUS_CATEGORY_IS, values: ['todo'] }
		]);
		expect(() => normalizeConditions([{ type: TaskAutomationConditionEnum.HAS_LABEL, values: [] }])).toThrow(/at least one value/);
		expect(() => normalizeConditions([{ type: TaskAutomationConditionEnum.TITLE_CONTAINS }])).toThrow(/needs a text/);
		expect(() => normalizeConditions([{ type: TaskAutomationConditionEnum.STATUS_CATEGORY_IS, values: ['soon'] }])).toThrow(/todo, in_progress, done/);
		expect(() => normalizeConditions([{ type: 'NEW' }])).toThrow(/not one the platform knows/);
		expect(() => normalizeConditions('nope')).toThrow(/must be a list/);
		expect(normalizeConditions(undefined)).toEqual([]);
	});

	it('holds a rule to its limits', () => {
		const many = Array.from({ length: TASK_AUTOMATION_LIMITS.conditionsPerRule + 1 }, () => ({ type: TaskAutomationConditionEnum.IS_OPEN }));
		expect(() => normalizeConditions(many)).toThrow(/at most/);
		const actions = Array.from({ length: TASK_AUTOMATION_LIMITS.actionsPerRule + 1 }, () => ({ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }));
		expect(() => normalizeActions(actions)).toThrow(/at most/);
		const values = Array.from({ length: TASK_AUTOMATION_LIMITS.valuesPerList + 1 }, (_, index) => `v${index}`);
		expect(() => normalizeConditions([{ type: TaskAutomationConditionEnum.STATUS_IS, values }])).toThrow(/at most/);
		expect(() => normalizeName('x'.repeat(TASK_AUTOMATION_LIMITS.nameLength + 1))).toThrow(/at most/);
		expect(() => normalizeName('  ')).toThrow(/needs a name/);
		expect(normalizeName('  Close parents ')).toBe('Close parents');
		expect(normalizeDescription('  ')).toBeNull();
		expect(() => normalizeDescription('x'.repeat(TASK_AUTOMATION_LIMITS.descriptionLength + 1))).toThrow(/at most/);
	});

	it('keeps each action’s value, needs at least one action, and refuses what an action is missing', () => {
		expect(
			normalizeActions([
				{ type: TaskAutomationActionEnum.SET_STATUS, category: 'done', status: 'dropped' },
				{ type: TaskAutomationActionEnum.SET_STATUS, status: ' in-progress ' },
				{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: [] },
				{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: ' ' }
			])
		).toEqual([
			{ type: TaskAutomationActionEnum.SET_STATUS, category: 'done' },
			{ type: TaskAutomationActionEnum.SET_STATUS, status: 'in-progress' },
			{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: [] },
			{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }
		]);
		expect(() => normalizeActions([])).toThrow(/at least one action/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.SET_STATUS }])).toThrow(/status or a category/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.SET_STATUS, category: 'later' }])).toThrow(/category/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.SET_PRIORITY }])).toThrow(/priority/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: [] }])).toThrow(/person/);
		// Replacing the assignees needs the list: a missing one is not "unassign everyone" (an empty one is).
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.SET_ASSIGNEES }])).toThrow(/people to assign/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: null as never }])).toThrow(/people to assign/);
		expect(() => normalizeActions([{ type: TaskAutomationActionEnum.ADD_LABELS }])).toThrow(/label/);
		expect(() =>
			normalizeActions([{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'x'.repeat(TASK_AUTOMATION_LIMITS.messageLength + 1) }])
		).toThrow(/message/);
	});

	it('lists what a rule names, for the organization check', () => {
		expect(
			referencesOf({
				trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['done'], fromStatuses: ['open'] },
				conditions: [
					{ type: TaskAutomationConditionEnum.PRIORITY_IS, values: ['high'] },
					{ type: TaskAutomationConditionEnum.HAS_LABEL, values: ['tag-1'] },
					{ type: TaskAutomationConditionEnum.ASSIGNEE_IS, values: ['e-1'] }
				],
				actions: [
					{ type: TaskAutomationActionEnum.SET_STATUS, status: 'in-progress' },
					{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: ['e-2'] },
					{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: ['tag-2'] }
				]
			})
		).toEqual({ statuses: ['done', 'open', 'in-progress'], priorities: ['high'], employeeIds: ['e-1', 'e-2'], tagIds: ['tag-1', 'tag-2'] });
	});
});

describe('templates', () => {
	it('offers the six built-in templates, each a valid rule', () => {
		expect(TASK_AUTOMATION_TEMPLATES.map((template) => template.key)).toEqual([
			'close-parent-when-subtasks-done',
			'reopen-parent-when-subtask-reopens',
			'status-sets-fields',
			'assigned-moves-in-progress',
			'due-date-notify-assignees',
			'link-closed-sets-status'
		]);
		for (const template of TASK_AUTOMATION_TEMPLATES) {
			expect(() => normalizeName(template.name)).not.toThrow();
			expect(normalizeTrigger(template.trigger).type).toBe(template.trigger.type);
			expect(normalizeConditions(template.conditions)).toEqual(template.conditions);
			expect(normalizeActions(template.actions)).toEqual(template.actions);
		}
	});

	it('hands out a copy, so a caller cannot change the template', () => {
		const copy = templateByKey('close-parent-when-subtasks-done');
		copy!.actions.push({ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES });
		expect(templateByKey('close-parent-when-subtasks-done')!.actions).toHaveLength(1);
		expect(templateByKey('nope')).toBeUndefined();
	});
});
