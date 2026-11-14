import {
	ITaskAutomationRule,
	ITaskAutomationTemplate,
	TaskAutomationActionEnum,
	TaskAutomationConditionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import {
	actionInput,
	apiErrorMessage,
	blankDraft,
	changeValueText,
	conditionInput,
	draftErrors,
	draftOfRule,
	draftOfTemplate,
	droppedOrder,
	movedOrder,
	newAction,
	newCondition,
	outcomeStatus,
	changedRuleInput,
	ruleInputOfDraft,
	rulesInOrder,
	viewOfLoadError
} from './task-automations-ui.helpers';
import { employeeName, priorityChoices, statusChoices, taskChoice } from './services/task-automations-directory.service';

const rule: ITaskAutomationRule = {
	id: 'rule-1',
	name: 'Review gets a label',
	description: null,
	projectId: 'project-1',
	organizationTeamId: null,
	isEnabled: true,
	position: 0,
	templateKey: null,
	trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['ready-for-review'], fromStatuses: [] },
	conditions: [
		{ type: TaskAutomationConditionEnum.IS_OPEN },
		{ type: TaskAutomationConditionEnum.TITLE_CONTAINS, text: 'release' }
	],
	actions: [
		{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: ['tag-1'] },
		{ type: TaskAutomationActionEnum.SET_STATUS, status: 'in-review' },
		{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }
	]
};

describe('task automations UI helpers', () => {
	it('round-trips a saved rule through the editor', () => {
		const draft = draftOfRule(rule);
		expect(draft.actions.map((action) => action.statusMode)).toEqual(['category', 'status', 'category']);
		expect(ruleInputOfDraft(draft)).toEqual({
			name: 'Review gets a label',
			description: null,
			projectId: 'project-1',
			organizationTeamId: null,
			isEnabled: true,
			trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['ready-for-review'], fromStatuses: [] },
			conditions: rule.conditions,
			actions: rule.actions
		});
	});

	it('sends only what each type uses, and the status lists only for a status change', () => {
		const draft = blankDraft();
		draft.name = '  Assigned  ';
		draft.trigger = {
			type: TaskAutomationTriggerEnum.TASK_ASSIGNED,
			toStatuses: ['done'],
			fromStatuses: [],
			mergedOnly: true
		};
		draft.conditions = [{ ...newCondition(TaskAutomationConditionEnum.HAS_LABEL), values: ['a', 'a', ' '], text: 'dropped' }];
		draft.actions = [
			{ ...newAction(TaskAutomationActionEnum.NOTIFY_ASSIGNEES), tagIds: ['dropped'], message: '  ' },
			{ ...newAction(TaskAutomationActionEnum.SET_PRIORITY), priority: ' high ' }
		];
		expect(ruleInputOfDraft(draft)).toEqual({
			name: 'Assigned',
			description: null,
			projectId: null,
			organizationTeamId: null,
			isEnabled: true,
			trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED },
			conditions: [{ type: TaskAutomationConditionEnum.HAS_LABEL, values: ['a'] }],
			actions: [{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }, { type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'high' }]
		});
	});

	it('sends “merged only” for a closed link alone, and reads it back from a saved rule (false when the rule has none)', () => {
		const linkRule: ITaskAutomationRule = {
			...rule,
			trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED, mergedOnly: true }
		};
		const draft = draftOfRule(linkRule);
		expect(draft.trigger.mergedOnly).toBe(true);
		expect(ruleInputOfDraft(draft).trigger).toEqual({
			type: TaskAutomationTriggerEnum.LINK_CLOSED,
			mergedOnly: true
		});

		// A rule saved before the option: off, and sent as off.
		const older = draftOfRule({ ...rule, trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED } });
		expect(older.trigger.mergedOnly).toBe(false);
		expect(ruleInputOfDraft(older).trigger).toEqual({
			type: TaskAutomationTriggerEnum.LINK_CLOSED,
			mergedOnly: false
		});

		// Another trigger never sends it, and a status change keeps its lists only.
		expect(
			ruleInputOfDraft({
				...draft,
				trigger: { ...draft.trigger, type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['done'] }
			}).trigger
		).toEqual({ type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: ['done'], fromStatuses: [] });

		// The link template starts with it off.
		const template: ITaskAutomationTemplate = {
			key: 'link-closed-sets-status',
			name: 'When a linked pull request or issue closes, set the status',
			description: 'x',
			trigger: { type: TaskAutomationTriggerEnum.LINK_CLOSED },
			conditions: [],
			actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }]
		};
		expect(draftOfTemplate(template).trigger.mergedOnly).toBe(false);
	});

	it('starts a rule from a template, switched off when the template needs the organization’s values', () => {
		const template: ITaskAutomationTemplate = {
			key: 'status-sets-fields',
			name: 'When the status changes, set the priority',
			description: 'x',
			trigger: { type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: [] },
			conditions: [],
			actions: [{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'high' }],
			needsInput: true
		};
		const draft = draftOfTemplate(template, 'Translated name');
		expect(draft).toMatchObject({ id: null, templateKey: 'status-sets-fields', name: 'Translated name', isEnabled: false });
		expect(draftOfTemplate({ ...template, needsInput: false }).isEnabled).toBe(true);
	});

	it('tells what keeps a draft from being saved', () => {
		const draft = blankDraft();
		expect(draftErrors(draft)).toEqual(['TASK_AUTOMATIONS.ERRORS.NAME_REQUIRED']);
		draft.name = 'x';
		draft.actions = [];
		expect(draftErrors(draft)).toEqual(['TASK_AUTOMATIONS.ERRORS.ACTION_REQUIRED']);
		draft.actions = [{ ...newAction(), statusMode: 'status', status: '' }];
		draft.conditions = [newCondition(TaskAutomationConditionEnum.STATUS_IS)];
		expect(draftErrors(draft)).toEqual(['TASK_AUTOMATIONS.ERRORS.CONDITION_VALUE', 'TASK_AUTOMATIONS.ERRORS.ACTION_VALUE']);
		draft.conditions = [{ ...newCondition(TaskAutomationConditionEnum.STATUS_IS), values: ['open'] }];
		draft.actions = [newAction(TaskAutomationActionEnum.SET_ASSIGNEES)];
		// Replacing the assignees with nobody is a rule too (it unassigns everyone).
		expect(draftErrors(draft)).toEqual([]);
		draft.actions = [newAction(TaskAutomationActionEnum.ADD_ASSIGNEES)];
		expect(draftErrors(draft)).toEqual(['TASK_AUTOMATIONS.ERRORS.ACTION_VALUE']);
		draft.actions = [newAction()];
		draft.name = 'x'.repeat(121);
		expect(draftErrors(draft)).toEqual(['TASK_AUTOMATIONS.ERRORS.NAME_TOO_LONG']);
	});

	it('names the picker each condition and action needs', () => {
		expect(conditionInput(TaskAutomationConditionEnum.STATUS_IS_NOT)).toBe('statuses');
		expect(conditionInput(TaskAutomationConditionEnum.STATUS_CATEGORY_IS)).toBe('categories');
		expect(conditionInput(TaskAutomationConditionEnum.PRIORITY_IS)).toBe('priorities');
		expect(conditionInput(TaskAutomationConditionEnum.NOT_HAS_LABEL)).toBe('tags');
		expect(conditionInput(TaskAutomationConditionEnum.ASSIGNEE_IS)).toBe('employees');
		expect(conditionInput(TaskAutomationConditionEnum.TITLE_CONTAINS)).toBe('text');
		expect(conditionInput(TaskAutomationConditionEnum.IS_SUBTASK)).toBeNull();
		expect(actionInput(TaskAutomationActionEnum.SET_STATUS)).toBe('status');
		expect(actionInput(TaskAutomationActionEnum.SET_ASSIGNEES)).toBe('employees');
		expect(actionInput(TaskAutomationActionEnum.REMOVE_LABELS)).toBe('tags');
		expect(actionInput(TaskAutomationActionEnum.NOTIFY_ASSIGNEES)).toBe('message');
	});

	it('moves a rule up, down and by drag, and keeps the order at an edge', () => {
		expect(movedOrder(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
		expect(movedOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
		expect(movedOrder(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
		expect(droppedOrder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
		expect(droppedOrder(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
		expect(droppedOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
	});

	it('sends only what an edit changed', () => {
		const before = ruleInputOfDraft(draftOfRule(rule));
		expect(changedRuleInput(before, { ...before, name: 'Other' })).toEqual({ name: 'Other' });
		expect(changedRuleInput(before, before)).toEqual({});
		expect(Object.keys(changedRuleInput(before, { ...before, actions: [] }))).toEqual(['actions']);
	});

	it('holds a title text to the platform’s 200 characters', () => {
		const draft = { ...draftOfRule(rule), conditions: [{ ...newCondition(), type: TaskAutomationConditionEnum.TITLE_CONTAINS, text: 'x'.repeat(201) }] };
		expect(draftErrors(draft as never)).toContain('TASK_AUTOMATIONS.ERRORS.TEXT_TOO_LONG');
	});

	it('holds every list to the platform’s 50 values', () => {
		const many = Array.from({ length: 51 }, (_, index) => `v-${index}`);
		const base = draftOfRule(rule);
		const statusChange = { ...base.trigger, type: TaskAutomationTriggerEnum.STATUS_CHANGED, toStatuses: many };
		expect(draftErrors({ ...base, trigger: statusChange })).toContain('TASK_AUTOMATIONS.ERRORS.TOO_MANY_VALUES');
		// Another trigger neither shows nor sends the status lists: they do not block Save.
		expect(draftErrors({ ...base, trigger: { ...statusChange, type: TaskAutomationTriggerEnum.TASK_CREATED } })).not.toContain(
			'TASK_AUTOMATIONS.ERRORS.TOO_MANY_VALUES'
		);
		expect(
			draftErrors({ ...base, conditions: [{ ...newCondition(TaskAutomationConditionEnum.HAS_LABEL), values: many }] })
		).toContain('TASK_AUTOMATIONS.ERRORS.TOO_MANY_VALUES');
		expect(draftErrors({ ...base, conditions: [{ ...newCondition(TaskAutomationConditionEnum.HAS_LABEL), values: many.slice(0, 50) }] })).not.toContain(
			'TASK_AUTOMATIONS.ERRORS.TOO_MANY_VALUES'
		);
	});

	it('applies an order to the rules as they are now, keeping what other writes made of them', () => {
		const a = { ...rule, id: 'a', position: 0, isEnabled: false };
		const b = { ...rule, id: 'b', position: 1 };
		const created = { ...rule, id: 'c', position: 2 };
		// `b` was deleted meanwhile and `c` created; `a` was switched off.
		const ordered = rulesInOrder([a, created], ['b', 'a']);
		expect(ordered.map((one) => [one.id, one.position, one.isEnabled])).toEqual([
			['a', 0, false],
			['c', 1, created.isEnabled]
		]);
		expect(rulesInOrder([a, b], ['b', 'a']).map((one) => one.id)).toEqual(['b', 'a']);
	});

	it('reads the API’s answers', () => {
		expect(viewOfLoadError({ status: 404 })).toBe('unavailable');
		expect(viewOfLoadError({ status: 403 })).toBe('forbidden');
		expect(viewOfLoadError({ status: 500 })).toBe('error');
		expect(apiErrorMessage({ error: { message: ['A', 'B'] } })).toBe('A B');
		expect(apiErrorMessage({ error: { message: ' The status is not one of the organization. ' } })).toBe(
			'The status is not one of the organization.'
		);
		expect(apiErrorMessage({})).toBeNull();
		expect(outcomeStatus(TaskAutomationRunOutcomeEnum.APPLIED)).toBe('success');
		expect(outcomeStatus(TaskAutomationRunOutcomeEnum.LOOP_GUARD)).toBe('warning');
		expect(outcomeStatus(TaskAutomationRunOutcomeEnum.FAILED)).toBe('danger');
		expect(outcomeStatus(TaskAutomationRunOutcomeEnum.NO_CHANGE)).toBe('basic');
		expect(changeValueText(['e-1', 'e-2'], new Map([['e-1', 'Ada']]))).toBe('Ada, e-2');
		expect(changeValueText(null)).toBe('—');
		expect(changeValueText([])).toBe('—');
	});

	it('offers the organization’s statuses and priorities by value, then the defaults it has no row for', () => {
		const statuses = statusChoices([
			{ value: 'open', name: 'To do' },
			{ value: 'open', name: 'Open (another project)' },
			{ value: 'shipped', name: 'Shipped' }
		]);
		expect(statuses.slice(0, 2)).toEqual([
			{ value: 'open', label: 'To do' },
			{ value: 'shipped', label: 'Shipped' }
		]);
		expect(statuses.map((choice) => choice.value)).toContain('done');
		expect(statuses.map((choice) => choice.value)).not.toContain('custom');
		expect(priorityChoices([{ value: 'high', name: 'High!' }])[0]).toEqual({ value: 'high', label: 'High!' });
		expect(employeeName({ fullName: 'A B', user: { firstName: 'Ada', lastName: 'Lovelace' } } as never)).toBe('Ada Lovelace');
		expect(employeeName({ fullName: '', user: { email: 'a@example.com' } } as never)).toBe('a@example.com');
		expect(taskChoice({ id: 't-1', title: 'Ship', prefix: 'API', number: 7 })).toEqual({ value: 't-1', label: 'Ship', detail: 'API-7' });
	});
});
