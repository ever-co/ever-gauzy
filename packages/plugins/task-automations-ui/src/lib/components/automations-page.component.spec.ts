// `@gauzy/ui-core/core` is replaced at the module boundary: its barrel boots the app's whole service graph, and this
// suite needs only the classes as injection tokens.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	NavMenuBuilderService: class NavMenuBuilderService {},
	PermissionsGuard: class PermissionsGuard {}
}));

import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import {
	ITaskAutomationRule,
	ITaskAutomationTemplate,
	TaskAutomationActionEnum,
	TaskAutomationRunOutcomeEnum,
	TaskAutomationStatusCategoryEnum,
	TaskAutomationTriggerEnum
} from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { TaskAutomationsApiService } from '../services/task-automations-api.service';
import { TaskAutomationsDirectoryService } from '../services/task-automations-directory.service';
import { ITaskAutomationDraft } from '../task-automations-ui.helpers';
import { TaskAutomationsPageComponent } from './automations-page.component';

const template: ITaskAutomationTemplate = {
	key: 'close-parent-when-subtasks-done',
	name: 'Close the parent when all sub-tasks are done',
	description: 'When the last open sub-task of a task is done, the task moves to the first done status.',
	trigger: { type: TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE },
	conditions: [],
	actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.DONE }]
};

const rule = (id: string, overrides: Partial<ITaskAutomationRule> = {}): ITaskAutomationRule => ({
	id,
	name: `Rule ${id}`,
	isEnabled: true,
	position: 0,
	trigger: { type: TaskAutomationTriggerEnum.TASK_ASSIGNED },
	conditions: [],
	actions: [{ type: TaskAutomationActionEnum.SET_STATUS, category: TaskAutomationStatusCategoryEnum.IN_PROGRESS }],
	...overrides
});

/** Settings → Automations. */
describe('TaskAutomationsPageComponent', () => {
	const api = {
		templates: jest.fn(),
		list: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		reorder: jest.fn(),
		remove: jest.fn(),
		test: jest.fn(),
		runs: jest.fn()
	};
	const directory = {
		statuses: jest.fn(),
		priorities: jest.fn(),
		tags: jest.fn(),
		employees: jest.fn(),
		projects: jest.fn(),
		teams: jest.fn(),
		tasks: jest.fn()
	};
	const toastr = { success: jest.fn(), danger: jest.fn() };

	function render() {
		TestBed.configureTestingModule({
			imports: [TaskAutomationsPageComponent],
			providers: [
				{ provide: TaskAutomationsApiService, useValue: api },
				{ provide: TaskAutomationsDirectoryService, useValue: directory },
				{ provide: ToastrService, useValue: toastr },
				{ provide: Store, useValue: { selectedOrganization$: of({ id: 'org-1' }), user: { id: 'user-1', tenantId: 'tenant-1' } } }
			]
		});
		const fixture = TestBed.createComponent(TaskAutomationsPageComponent);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		return {
			fixture,
			component: fixture.componentInstance,
			find: (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null
		};
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.templates.mockReturnValue(of([template]));
		api.list.mockReturnValue(of([rule('a'), rule('b', { isEnabled: false })]));
		directory.statuses.mockReturnValue(of([{ value: 'done', label: 'Done' }]));
		directory.priorities.mockReturnValue(of([]));
		directory.tags.mockReturnValue(of([]));
		directory.employees.mockReturnValue(of([{ value: 'e-1', label: 'Ada' }]));
		directory.projects.mockReturnValue(of([{ value: 'project-1', label: 'Website' }]));
		directory.teams.mockReturnValue(of([]));
		directory.tasks.mockReturnValue(of([{ value: 'task-1', label: 'Ship', detail: 'API-7' }]));
	});

	it('the feature is off (404): the notice only', () => {
		api.templates.mockReturnValue(throwError(() => ({ status: 404 })));
		const { component, find } = render();
		expect(component.view()).toBe('unavailable');
		expect(find('unavailable')).not.toBeNull();
		expect(find('rules')).toBeNull();
	});

	it('without the permission (403): says so', () => {
		api.list.mockReturnValue(throwError(() => ({ status: 403 })));
		const { component, find } = render();
		expect(component.view()).toBe('forbidden');
		expect(find('forbidden')).not.toBeNull();
	});

	it('another failure offers a retry', () => {
		api.list.mockReturnValue(throwError(() => ({ status: 500 })));
		const { component, find, fixture } = render();
		expect(component.view()).toBe('error');
		api.list.mockReturnValue(of([]));
		find('retry')?.click();
		fixture.detectChanges();
		expect(component.view()).toBe('ready');
		expect(find('empty')).not.toBeNull();
	});

	it('lists the organization’s rules in their order, and reads the pickers’ lists', () => {
		const { find, component } = render();
		expect(api.list).toHaveBeenCalledWith('org-1');
		expect(find('rule-a')).not.toBeNull();
		expect(find('rule-b')).not.toBeNull();
		expect(directory.statuses).toHaveBeenCalledWith('org-1', 'tenant-1');
		expect(component.directory().projects).toEqual([{ value: 'project-1', label: 'Website' }]);
		expect(component.tasks()).toHaveLength(1);
	});

	it('switches a rule on and off, and puts the switch back when the API refuses', () => {
		const { component } = render();
		api.update.mockReturnValue(of(rule('b', { isEnabled: true })));
		component.toggle(component.rules()[1], true);
		expect(api.update).toHaveBeenCalledWith('b', { isEnabled: true }, 'org-1');
		expect(component.rules()[1].isEnabled).toBe(true);

		api.update.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'No.' } })));
		component.toggle(component.rules()[0], false);
		expect(component.rules()[0].isEnabled).toBe(true);
		expect(component.actionError()).toBe('No.');
	});

	it('moves a rule down, and goes back to the old order when the API refuses', () => {
		const { component } = render();
		api.reorder.mockReturnValue(of([rule('b'), rule('a')]));
		component.move(0, 1);
		expect(api.reorder).toHaveBeenCalledWith(['b', 'a'], 'org-1');
		expect(component.rules().map((one) => one.id)).toEqual(['b', 'a']);

		api.reorder.mockReturnValue(throwError(() => ({ status: 500 })));
		component.move(0, 1);
		expect(component.rules().map((one) => one.id)).toEqual(['b', 'a']);
		expect(component.actionError()).toBe('TASK_AUTOMATIONS.ERRORS.REORDER');
		// At an edge nothing is sent.
		api.reorder.mockClear();
		component.move(0, -1);
		expect(api.reorder).not.toHaveBeenCalled();
	});

	it('reorders by drag and drop', () => {
		const { component } = render();
		api.reorder.mockReturnValue(of([rule('b'), rule('a')]));
		component.dragFrom.set(1);
		component.drop(0);
		expect(api.reorder).toHaveBeenCalledWith(['b', 'a'], 'org-1');
		expect(component.dragFrom()).toBeNull();
	});

	it('creates a rule from a template, with the template’s key', () => {
		const { component, find, fixture } = render();
		find('show-templates')?.click();
		fixture.detectChanges();
		expect(find('template-close-parent-when-subtasks-done')).not.toBeNull();
		component.startFromTemplate(template);
		fixture.detectChanges();
		expect(find('editing')).not.toBeNull();
		const draft = (component.editing() as ITaskAutomationDraft);
		api.create.mockReturnValue(of(rule('c', { name: draft.name })));
		component.save(draft);
		expect(api.create).toHaveBeenCalledWith(
			expect.objectContaining({
				templateKey: 'close-parent-when-subtasks-done',
				name: 'Close the parent when all sub-tasks are done',
				trigger: { type: TaskAutomationTriggerEnum.ALL_SUBTASKS_DONE }
			}),
			'org-1'
		);
		expect(component.rules().map((one) => one.id)).toEqual(['a', 'b', 'c']);
		expect(component.editing()).toBeNull();
		expect(toastr.success).toHaveBeenCalled();
	});

	it('edits a rule, and shows the API’s refusal as it answers', () => {
		const { component } = render();
		component.edit(component.rules()[0]);
		const draft = { ...(component.editing() as ITaskAutomationDraft), name: 'Renamed' };
		api.update.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'The status is not one of the organization.' } })));
		component.save(draft);
		expect(component.actionError()).toBe('The status is not one of the organization.');
		expect(component.editing()).not.toBeNull();

		api.update.mockReturnValue(of(rule('a', { name: 'Renamed' })));
		component.save(draft);
		// Only what changed is sent: the switch another manager may have changed meanwhile is not written back.
		expect(api.update).toHaveBeenLastCalledWith('a', { name: 'Renamed' }, 'org-1');
		expect(component.rules()[0].name).toBe('Renamed');
	});

	it('takes another manager’s switch from a save’s answer when nothing was toggled here', () => {
		const { component } = render();
		api.update.mockReturnValue(of(rule('a', { name: 'Renamed', isEnabled: false })));
		component.edit(component.rules()[0]);
		component.save({ ...(component.editing() as ITaskAutomationDraft), name: 'Renamed' });
		expect(component.rules()[0]).toMatchObject({ name: 'Renamed', isEnabled: false });
	});

	it('drops a dry run under way when another task is picked', () => {
		const answer$ = new Subject<never>();
		api.test.mockReturnValue(answer$);
		api.runs.mockReturnValue(of([]));
		const { component } = render();
		component.open(component.rules()[0]);
		component.pickTestTask('task-1');
		component.runTest(component.rules()[0]);
		component.pickTestTask('task-2');
		expect(component.testing()).toBe(false);
		expect(answer$.observed).toBe(false);
	});

	it('keeps a switch that landed while a name-only save was under way', () => {
		const { component } = render();
		const save$ = new Subject<ITaskAutomationRule>();
		api.update.mockReturnValueOnce(save$).mockReturnValueOnce(of(rule('a', { isEnabled: false })));
		component.edit(component.rules()[0]);
		component.save({ ...(component.editing() as ITaskAutomationDraft), name: 'Renamed' });
		component.toggle(component.rules()[0], false);
		// The save answers last, with the switch as it was when the save was read.
		save$.next(rule('a', { name: 'Renamed', isEnabled: true }));
		expect(component.rules()[0]).toMatchObject({ name: 'Renamed', isEnabled: false });
	});

	it('closes only the editor that saved; a new draft opened meanwhile stays', () => {
		const { component } = render();
		const save$ = new Subject<ITaskAutomationRule>();
		api.update.mockReturnValue(save$);
		component.edit(component.rules()[0]);
		component.save({ ...(component.editing() as ITaskAutomationDraft), name: 'Renamed' });
		component.startBlank();
		const fresh = component.editing();
		save$.next(rule('a', { name: 'Renamed' }));
		expect(component.editing()).toBe(fresh);
	});

	it('takes only the switch from a toggle answer, and keeps one order at a time', () => {
		const { component } = render();
		const toggle$ = new Subject<ITaskAutomationRule>();
		api.update.mockReturnValueOnce(toggle$).mockReturnValueOnce(of(rule('a', { name: 'Renamed' })));
		component.toggle(component.rules()[0], false);
		component.edit(component.rules()[0]);
		component.save({ ...(component.editing() as ITaskAutomationDraft), name: 'Renamed' });
		toggle$.next(rule('a', { isEnabled: false }));
		expect(component.rules()[0]).toMatchObject({ name: 'Renamed', isEnabled: false });

		api.reorder.mockReturnValue(new Subject());
		component.move(0, 1);
		api.reorder.mockClear();
		component.dragFrom.set(0);
		component.drop(1);
		expect(api.reorder).not.toHaveBeenCalled();
	});

	it('opening another rule drops a dry run under way; picking another task clears the answer', () => {
		api.test.mockReturnValue(new Subject());
		api.runs.mockReturnValue(of([]));
		const { component } = render();
		component.open(component.rules()[0]);
		component.pickTestTask('task-1');
		component.runTest(component.rules()[0]);
		component.open(component.rules()[1]);
		expect(component.testing()).toBe(false);

		api.test.mockReturnValue(of({ outcome: 'APPLIED', conditions: [], changes: [] }));
		component.runTest(component.rules()[1]);
		expect(component.testResult()).not.toBeNull();
		component.pickTestTask('task-2');
		expect(component.testResult()).toBeNull();
	});

	it('shows a dry run failure only for the rule still open', () => {
		const failure$ = new Subject<never>();
		api.test.mockReturnValue(failure$);
		api.runs.mockReturnValue(of([]));
		const { component } = render();
		component.open(component.rules()[0]);
		component.testTaskId.set('task-1');
		component.runTest(component.rules()[0]);
		component.open(component.rules()[1]);
		failure$.error({ status: 500 });
		expect(component.actionError()).toBeNull();
	});

	it('offers nothing of the organization before when it reloads', () => {
		const { component } = render();
		component.testTaskId.set('task-1');
		directory.tasks.mockReturnValue(new Subject());
		directory.employees.mockReturnValue(new Subject());
		component.reload();
		expect(component.tasks()).toEqual([]);
		expect(component.testTaskId()).toBeNull();
		expect(component.directory().employees).toEqual([]);
	});

	it('deletes a rule after a confirmation', () => {
		const { component, find, fixture } = render();
		find('delete-a')?.click();
		fixture.detectChanges();
		expect(api.remove).not.toHaveBeenCalled();
		api.remove.mockReturnValue(of({ id: 'a', deleted: true }));
		find('confirm-delete-a')?.click();
		fixture.detectChanges();
		expect(api.remove).toHaveBeenCalledWith('a', 'org-1');
		expect(component.rules().map((one) => one.id)).toEqual(['b']);
	});

	it('tests a rule on a task and shows what would happen, and lists its runs', () => {
		api.runs.mockReturnValue(
			of([
				{
					id: 'run-1',
					ruleId: 'a',
					taskId: 'task-1',
					eventKey: 'e:task-1',
					triggerType: TaskAutomationTriggerEnum.TASK_ASSIGNED,
					outcome: TaskAutomationRunOutcomeEnum.APPLIED,
					depth: 0,
					details: { changes: [{ action: TaskAutomationActionEnum.SET_STATUS, field: 'status', from: 'open', to: 'done' }] }
				}
			])
		);
		const { component, find, fixture } = render();
		component.open(component.rules()[0]);
		fixture.detectChanges();
		expect(api.runs).toHaveBeenCalledWith('a', 20, 'org-1');
		expect(find('run-run-1')?.textContent).toContain('status: open → Done');

		api.test.mockReturnValue(
			of({
				ruleId: 'a',
				taskId: 'task-1',
				triggerMatches: null,
				triggerNote: 'Runs when someone is added as an assignee.',
				conditions: [],
				changes: [{ action: TaskAutomationActionEnum.SET_STATUS, field: 'status', from: 'open', to: 'in-progress' }],
				outcome: TaskAutomationRunOutcomeEnum.APPLIED
			})
		);
		component.testTaskId.set('task-1');
		component.runTest(component.rules()[0]);
		fixture.detectChanges();
		expect(api.test).toHaveBeenCalledWith('a', 'task-1', 'org-1');
		expect(find('test-result')).not.toBeNull();
		expect(find('test-changes')?.textContent).toContain('open → in-progress');
		expect(find('test-outcome')?.textContent).toContain('TASK_AUTOMATIONS.OUTCOMES.APPLIED');
	});

	it('filters the tasks of the dry run as the user types', () => {
		directory.tasks.mockReturnValue(
			of([
				{ value: 't-1', label: 'Ship the notes', detail: 'API-7' },
				{ value: 't-2', label: 'Fix the login', detail: 'WEB-3' }
			])
		);
		const { component } = render();
		component.taskFilter.set('web');
		expect(component.filteredTasks().map((task) => task.value)).toEqual(['t-2']);
		component.taskFilter.set('');
		expect(component.filteredTasks()).toHaveLength(2);
	});

	it('offers the statuses and priorities of the project the edited rule is narrowed to', () => {
		const { component } = render();
		directory.statuses.mockReturnValue(of([{ value: 'shipped', label: 'Shipped' }]));
		directory.priorities.mockReturnValue(of([{ value: 'p0', label: 'P0' }]));
		component.loadScopedChoices({ projectId: 'project-1', organizationTeamId: null });
		expect(directory.statuses).toHaveBeenLastCalledWith('org-1', 'tenant-1', { projectId: 'project-1', organizationTeamId: null });
		expect(component.directory().statuses.map((choice) => choice.value)).toEqual(['done', 'shipped']);
		expect(component.directory().priorities.map((choice) => choice.value)).toEqual(['p0']);
		component.loadScopedChoices({});
		expect(component.directory().statuses.map((choice) => choice.value)).toEqual(['done']);
	});

	it('drops an answer that comes back after the organization changed', () => {
		const { component } = render();
		const save$ = new Subject<ITaskAutomationRule>();
		api.create.mockReturnValue(save$);
		component.startBlank();
		component.save({ ...(component.editing() as ITaskAutomationDraft), name: 'In A' });
		component.organizationId.set('org-2');
		save$.next(rule('late'));
		expect(component.rules().map((one) => one.id)).toEqual(['a', 'b']);
	});

	it('lets the Test button go when a switch of organization cancels a dry run under way', () => {
		const { component } = render();
		api.test.mockReturnValue(new Subject());
		api.runs.mockReturnValue(of([]));
		component.open(component.rules()[0]);
		component.testTaskId.set('task-1');
		component.runTest(component.rules()[0]);
		expect(component.testing()).toBe(true);
		(component as unknown as { cancelPending(): void }).cancelPending();
		expect(component.testing()).toBe(false);
	});

	it('applies a late order to the rules as they are, keeping a switch saved meanwhile', () => {
		const { component } = render();
		const order$ = new Subject<ITaskAutomationRule[]>();
		api.reorder.mockReturnValue(order$);
		component.move(0, 1);
		api.update.mockReturnValue(of(rule('a', { isEnabled: false })));
		component.toggle(component.rules().find((one) => one.id === 'a') as ITaskAutomationRule, false);
		order$.next([rule('b'), rule('a')]);
		expect(component.rules().map((one) => [one.id, one.isEnabled])).toEqual([
			['b', false],
			['a', false]
		]);
	});

	it('drops another rule’s late history', () => {
		const late$ = new Subject<never[]>();
		api.runs.mockReturnValueOnce(late$).mockReturnValue(of([]));
		const { component } = render();
		component.open(component.rules()[0]);
		component.open(component.rules()[1]);
		late$.next([]);
		expect(component.selectedId()).toBe('b');
		expect(component.runsState()).toBe('ready');
	});

	it('says when the runs cannot be read', () => {
		api.runs.mockReturnValue(throwError(() => ({ status: 500 })));
		const { component, find, fixture } = render();
		component.open(component.rules()[0]);
		fixture.detectChanges();
		expect(find('runs-error')).not.toBeNull();
	});
});
