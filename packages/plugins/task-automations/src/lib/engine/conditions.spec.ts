import { TaskAutomationConditionEnum, TaskAutomationStatusCategoryEnum } from '@gauzy/contracts';
import { evaluateCondition, evaluateConditions } from './conditions';
import { CATALOG, task } from './testing/fixtures';

const check = (type: TaskAutomationConditionEnum, overrides = {}, extra: { values?: string[]; text?: string } = {}) =>
	evaluateCondition({ type, ...extra }, task(overrides), CATALOG).passed;

describe('conditions', () => {
	it('STATUS_IS / STATUS_IS_NOT', () => {
		expect(check(TaskAutomationConditionEnum.STATUS_IS, {}, { values: ['open'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.STATUS_IS, {}, { values: ['done', 'st-progress'] })).toBe(false);
		expect(check(TaskAutomationConditionEnum.STATUS_IS_NOT, {}, { values: ['done'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.STATUS_IS_NOT, {}, { values: ['Open'] })).toBe(false);
	});

	it('STATUS_CATEGORY_IS', () => {
		expect(check(TaskAutomationConditionEnum.STATUS_CATEGORY_IS, {}, { values: [TaskAutomationStatusCategoryEnum.TODO] })).toBe(true);
		expect(
			check(TaskAutomationConditionEnum.STATUS_CATEGORY_IS, { status: 'in-progress', taskStatusId: 'st-progress' }, { values: [TaskAutomationStatusCategoryEnum.TODO] })
		).toBe(false);
		// A custom status without flags is of no category.
		expect(
			check(TaskAutomationConditionEnum.STATUS_CATEGORY_IS, { status: 'waiting', taskStatusId: 'st-custom' }, { values: [TaskAutomationStatusCategoryEnum.TODO] })
		).toBe(false);
	});

	it('IS_OPEN / IS_DONE (cancelled is neither)', () => {
		expect(check(TaskAutomationConditionEnum.IS_OPEN)).toBe(true);
		expect(check(TaskAutomationConditionEnum.IS_DONE)).toBe(false);
		expect(check(TaskAutomationConditionEnum.IS_DONE, { status: 'done', taskStatusId: 'st-done' })).toBe(true);
		expect(check(TaskAutomationConditionEnum.IS_OPEN, { status: 'cancelled', taskStatusId: null })).toBe(false);
		expect(check(TaskAutomationConditionEnum.IS_DONE, { status: 'cancelled', taskStatusId: null })).toBe(false);
	});

	it('PRIORITY_IS', () => {
		expect(check(TaskAutomationConditionEnum.PRIORITY_IS, { priority: 'high' }, { values: ['high'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.PRIORITY_IS, { taskPriorityId: 'pr-high' }, { values: ['High'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.PRIORITY_IS, {}, { values: ['high'] })).toBe(false);
	});

	it('HAS_LABEL / NOT_HAS_LABEL', () => {
		expect(check(TaskAutomationConditionEnum.HAS_LABEL, { tagIds: ['tag-1'] }, { values: ['tag-2', 'tag-1'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.HAS_LABEL, { tagIds: [] }, { values: ['tag-1'] })).toBe(false);
		expect(check(TaskAutomationConditionEnum.NOT_HAS_LABEL, { tagIds: ['tag-3'] }, { values: ['tag-1'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.NOT_HAS_LABEL, { tagIds: ['tag-1'] }, { values: ['tag-1'] })).toBe(false);
	});

	it('IS_ASSIGNED / IS_UNASSIGNED / ASSIGNEE_IS', () => {
		expect(check(TaskAutomationConditionEnum.IS_ASSIGNED, { memberIds: ['e-1'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.IS_ASSIGNED)).toBe(false);
		expect(check(TaskAutomationConditionEnum.IS_UNASSIGNED)).toBe(true);
		expect(check(TaskAutomationConditionEnum.ASSIGNEE_IS, { memberIds: ['e-1', 'e-2'] }, { values: ['e-2'] })).toBe(true);
		expect(check(TaskAutomationConditionEnum.ASSIGNEE_IS, { memberIds: ['e-1'] }, { values: ['e-2'] })).toBe(false);
	});

	it('IS_SUBTASK / IS_NOT_SUBTASK', () => {
		expect(check(TaskAutomationConditionEnum.IS_SUBTASK, { parentId: 'p-1' })).toBe(true);
		expect(check(TaskAutomationConditionEnum.IS_SUBTASK)).toBe(false);
		expect(check(TaskAutomationConditionEnum.IS_NOT_SUBTASK)).toBe(true);
	});

	it('TITLE_CONTAINS, without regard to case; an empty text never matches', () => {
		expect(check(TaskAutomationConditionEnum.TITLE_CONTAINS, {}, { text: 'RELEASE' })).toBe(true);
		expect(check(TaskAutomationConditionEnum.TITLE_CONTAINS, {}, { text: 'invoice' })).toBe(false);
		expect(check(TaskAutomationConditionEnum.TITLE_CONTAINS, {}, { text: '  ' })).toBe(false);
	});

	it('fails an unknown condition rather than guess', () => {
		expect(evaluateCondition({ type: 'SOMETHING_NEW' as TaskAutomationConditionEnum }, task(), CATALOG)).toEqual({
			type: 'SOMETHING_NEW',
			passed: false,
			detail: 'unknown condition'
		});
	});

	it('needs every condition, evaluates each one, and passes with none', () => {
		const result = evaluateConditions(
			[{ type: TaskAutomationConditionEnum.IS_OPEN }, { type: TaskAutomationConditionEnum.IS_ASSIGNED }],
			task(),
			CATALOG
		);
		expect(result.passed).toBe(false);
		expect(result.results.map((one) => one.passed)).toEqual([true, false]);
		expect(evaluateConditions([], task(), CATALOG).passed).toBe(true);
		expect(evaluateConditions(undefined, task(), CATALOG).passed).toBe(true);
	});
});
