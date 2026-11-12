import { TaskAutomationActionEnum, TaskAutomationRunOutcomeEnum, TaskAutomationStatusCategoryEnum } from '@gauzy/contracts';
import { outcomeOfPlan, planActions, planHasEffect } from './actions';
import { CATALOG, task } from './testing/fixtures';

describe('actions', () => {
	describe('SET_STATUS', () => {
		it('sets a named status (by value or id) with its row', () => {
			const plan = planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'done' }], task(), CATALOG);
			expect(plan.update).toEqual({ status: 'done', taskStatusId: 'st-done' });
			expect(plan.changes).toEqual([{ action: TaskAutomationActionEnum.SET_STATUS, field: 'status', from: 'open', to: 'done' }]);
			expect(planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'st-progress' }], task(), CATALOG).update).toEqual({
				status: 'in-progress',
				taskStatusId: 'st-progress'
			});
		});

		it('sets the first status of a category, the project’s own first', () => {
			const action = { type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE };
			expect(planActions([action], task(), CATALOG).update).toEqual({ status: 'done', taskStatusId: 'st-done' });
			expect(planActions([action], task({ projectId: 'project-web' }), CATALOG).update).toEqual({
				status: 'shipped',
				taskStatusId: 'st-shipped'
			});
		});

		it('falls back to the default value when the organization has no status of the category', () => {
			const action = { type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.IN_PROGRESS };
			expect(planActions([action], task({ taskStatusId: null }), { statuses: [], priorities: [] }).update).toEqual({
				status: 'in-progress',
				taskStatusId: null
			});
		});

		it('reports a status the task already has as no change, and an unknown one as failed', () => {
			const same = planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'open' }], task(), CATALOG);
			expect(same.update).toEqual({});
			expect(same.changes[0].note).toBe('Already set.');
			const unknown = planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'nope' }], task(), CATALOG);
			expect(unknown.update).toEqual({});
			expect(unknown.changes[0].failed).toBe(true);
		});

		it('sets the status again when the value moved without its row', () => {
			// A value-only update left the done row behind: the task is open, so "done" is a change.
			const stale = planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'done' }], task({ status: 'open', taskStatusId: 'st-done' }), CATALOG);
			expect(stale.update).toEqual({ status: 'done', taskStatusId: 'st-done' });
			const priority = planActions(
				[{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'high' }],
				task({ priority: 'low', taskPriorityId: 'pr-high' }),
				CATALOG
			);
			expect(priority.update).toEqual({ priority: 'high', taskPriorityId: 'pr-high' });
		});
	});

	describe('SET_PRIORITY', () => {
		it('sets a priority with its row, or the default value without one', () => {
			expect(planActions([{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'high' }], task(), CATALOG).update).toEqual({
				priority: 'high',
				taskPriorityId: 'pr-high'
			});
			expect(planActions([{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'urgent' }], task(), CATALOG).update).toEqual({
				priority: 'urgent',
				taskPriorityId: null
			});
			const same = planActions([{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'High' }], task({ taskPriorityId: 'pr-high', priority: 'high' }), CATALOG);
			expect(same.update).toEqual({});
			expect(planActions([{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: '?' }], task(), CATALOG).changes[0].failed).toBe(true);
		});
	});

	describe('ADD_ASSIGNEES / SET_ASSIGNEES', () => {
		it('adds people to the assignees, once each', () => {
			const plan = planActions([{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: ['e-2', 'e-1'] }], task({ memberIds: ['e-1'] }), CATALOG);
			expect(plan.update).toEqual({ memberIds: ['e-1', 'e-2'] });
			const same = planActions([{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: ['e-1'] }], task({ memberIds: ['e-1'] }), CATALOG);
			expect(same.update).toEqual({});
		});

		it('replaces the assignees; an empty list unassigns everyone', () => {
			expect(planActions([{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: ['e-3'] }], task({ memberIds: ['e-1'] }), CATALOG).update).toEqual({
				memberIds: ['e-3']
			});
			expect(planActions([{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: [] }], task({ memberIds: ['e-1'] }), CATALOG).update).toEqual({
				memberIds: []
			});
		});

		it('leaves out people who are not employees of the organization, and reports them', () => {
			const catalog = { ...CATALOG, employeeIds: new Set(['e-1']) };
			const plan = planActions([{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: ['e-1', 'stranger'] }], task(), catalog);
			expect(plan.update).toEqual({ memberIds: ['e-1'] });
			expect(plan.changes.some((change) => change.failed)).toBe(true);
			// Replacing with nobody but strangers is refused: it would unassign everyone.
			const refused = planActions([{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: ['stranger'] }], task({ memberIds: ['e-1'] }), catalog);
			expect(refused.update).toEqual({});
			// So is a replacement where one of the people is a stranger: the assignees stay, the other actions run.
			const partial = planActions(
				[
					{ type: TaskAutomationActionEnum.SET_ASSIGNEES, employeeIds: ['e-1', 'stranger'] },
					{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: 'high' }
				],
				task({ memberIds: ['e-3'] }),
				catalog
			);
			expect(partial.update).toEqual({ priority: 'high', taskPriorityId: 'pr-high' });
			expect(partial.changes[0]).toMatchObject({ field: 'members', failed: true });
		});
	});

	describe('ADD_LABELS / REMOVE_LABELS', () => {
		it('adds and removes labels', () => {
			expect(planActions([{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: ['tag-2'] }], task({ tagIds: ['tag-1'] }), CATALOG).update).toEqual({
				tagIds: ['tag-1', 'tag-2']
			});
			expect(planActions([{ type: TaskAutomationActionEnum.REMOVE_LABELS, tagIds: ['tag-1'] }], task({ tagIds: ['tag-1', 'tag-2'] }), CATALOG).update).toEqual({
				tagIds: ['tag-2']
			});
			expect(planActions([{ type: TaskAutomationActionEnum.REMOVE_LABELS, tagIds: ['tag-9'] }], task({ tagIds: ['tag-1'] }), CATALOG).update).toEqual({});
		});

		it('does not add labels of another organization', () => {
			const catalog = { ...CATALOG, tagIds: new Set(['tag-1']) };
			const plan = planActions([{ type: TaskAutomationActionEnum.ADD_LABELS, tagIds: ['tag-1', 'tag-x'] }], task(), catalog);
			expect(plan.update).toEqual({ tagIds: ['tag-1'] });
			expect(plan.changes[0].failed).toBe(true);
		});
	});

	describe('NOTIFY_ASSIGNEES', () => {
		it('notifies the assignees as the earlier actions left them', () => {
			const plan = planActions(
				[
					{ type: TaskAutomationActionEnum.ADD_ASSIGNEES, employeeIds: ['e-2'] },
					{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: '  Overdue  ' }
				],
				task({ memberIds: ['e-1'] }),
				CATALOG
			);
			expect(plan.notices).toEqual([{ employeeIds: ['e-1', 'e-2'], message: 'Overdue', actionIndex: 1 }]);
		});

		it('keeps each notice action apart (its place in the rule)', () => {
			const plan = planActions(
				[
					{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'First' },
					{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES, message: 'Second' }
				],
				task({ memberIds: ['e-1'] }),
				CATALOG
			);
			expect(plan.notices.map((notice) => [notice.message, notice.actionIndex])).toEqual([
				['First', 0],
				['Second', 1]
			]);
		});

		it('sends nothing to a task without assignees', () => {
			const plan = planActions([{ type: TaskAutomationActionEnum.NOTIFY_ASSIGNEES }], task(), CATALOG);
			expect(plan.notices).toEqual([]);
			expect(plan.changes[0].note).toBe('The task has no assignee.');
		});
	});

	it('applies the actions in order, each on what the previous ones set', () => {
		const plan = planActions(
			[
				{ type: TaskAutomationActionEnum.SET_STATUS, status: 'in-progress' },
				{ type: TaskAutomationActionEnum.SET_STATUS, status: 'done' }
			],
			task(),
			CATALOG
		);
		expect(plan.update).toEqual({ status: 'done', taskStatusId: 'st-done' });
		expect(plan.changes.map((change) => change.to)).toEqual(['in-progress', 'done']);
	});

	it('reports an unknown action as failed', () => {
		const plan = planActions([{ type: 'LAUNCH' as TaskAutomationActionEnum }], task(), CATALOG);
		expect(plan.changes[0].failed).toBe(true);
	});

	it('tells what a run of a plan records', () => {
		const applied = planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'done' }], task(), CATALOG);
		expect(planHasEffect(applied)).toBe(true);
		expect(outcomeOfPlan(applied)).toBe(TaskAutomationRunOutcomeEnum.APPLIED);
		const partial = planActions(
			[
				{ type: TaskAutomationActionEnum.SET_STATUS, status: 'done' },
				{ type: TaskAutomationActionEnum.SET_PRIORITY, priority: '?' }
			],
			task(),
			CATALOG
		);
		expect(outcomeOfPlan(partial)).toBe(TaskAutomationRunOutcomeEnum.PARTIAL);
		expect(outcomeOfPlan(planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: 'open' }], task(), CATALOG))).toBe(
			TaskAutomationRunOutcomeEnum.NO_CHANGE
		);
		expect(outcomeOfPlan(planActions([{ type: TaskAutomationActionEnum.SET_STATUS, status: '?' }], task(), CATALOG))).toBe(
			TaskAutomationRunOutcomeEnum.FAILED
		);
	});
});
