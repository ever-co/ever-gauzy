import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { LinearConflict, LinearUiService } from '../../services/linear-ui.service';
import { LinearConflictsComponent } from './linear-conflicts.component';

function conflict(overrides: Partial<LinearConflict> = {}): LinearConflict {
	return {
		id: 'c-1',
		integrationId: 'int-1',
		mappingId: 'map-1',
		runId: 'run-1',
		taskId: 'task-1',
		sourceId: 'issue-1',
		field: 'title',
		syncedValue: 'Old',
		platformValue: 'Ours',
		externalValue: 'Theirs',
		status: 'open',
		resolution: null,
		resolvedAt: null,
		resolvedByUserId: null,
		createdAt: '2026-11-11T08:00:00.000Z',
		...overrides
	};
}

/** The conflict list: what changed on both sides, and the two ways to resolve it. */
describe('LinearConflictsComponent', () => {
	const api = { conflicts: jest.fn(), resolveConflict: jest.fn(), taskTitle: jest.fn() };

	function render(inputs: { runId?: string | null } = {}) {
		TestBed.configureTestingModule({
			imports: [LinearConflictsComponent],
			providers: [{ provide: LinearUiService, useValue: api }]
		});
		const fixture = TestBed.createComponent(LinearConflictsComponent);
		fixture.componentRef.setInput('integrationId', 'int-1');
		if (inputs.runId !== undefined) fixture.componentRef.setInput('runId', inputs.runId);
		fixture.detectChanges();
		const el: HTMLElement = fixture.nativeElement;
		const find = (test: string) => el.querySelector(`[data-test="${test}"]`) as HTMLElement | null;
		return { fixture, component: fixture.componentInstance, el, find };
	}

	beforeEach(() => {
		jest.resetAllMocks();
		api.taskTitle.mockReturnValue(of('Fix login'));
	});

	it('lists the open conflicts: the task, the field, both values, when', () => {
		api.conflicts.mockReturnValue(
			of([
				conflict(),
				conflict({ id: 'c-2', field: 'description', platformValue: '<p>Our <b>text</b></p>', externalValue: null }),
				conflict({ id: 'c-3', taskId: 'task-2', field: 'dueDate', platformValue: '2026-11-20T09:00:00.000Z', externalValue: '2026-11-21T09:00:00.000Z' })
			])
		);
		api.taskTitle.mockImplementation((taskId: string) => of(taskId === 'task-1' ? 'Fix login' : null));
		const { el, find } = render();

		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: null });
		// One read per task, not per conflict.
		expect(api.taskTitle).toHaveBeenCalledTimes(2);
		const first = find('conflict-c-1') as HTMLElement;
		expect(first.querySelector('[data-test="task"]')?.textContent).toContain('Fix login');
		expect(first.querySelector('[data-test="task"]')?.getAttribute('href')).toBe('/pages/tasks/view/task-1');
		expect(first.textContent).toContain('LINEAR.CONFLICTS.ITEM');
		expect(first.querySelector('[data-test="field"]')?.textContent).toContain('LINEAR.CONFLICTS.FIELDS.title');
		expect(first.querySelector('[data-test="platform-value"]')?.textContent).toContain('Ours');
		expect(first.querySelector('[data-test="external-value"]')?.textContent).toContain('Theirs');

		const description = find('conflict-c-2') as HTMLElement;
		expect(description.querySelector('[data-test="platform-value"]')?.textContent?.trim()).toBe('Our text');
		expect(description.querySelector('[data-test="platform-value"] b')).toBeNull();
		expect(description.querySelector('[data-test="external-value"]')?.textContent).toContain('LINEAR.CONFLICTS.EMPTY_VALUE');

		const due = find('conflict-c-3') as HTMLElement;
		// A task whose title cannot be read still opens.
		expect(due.querySelector('[data-test="task"]')?.textContent).toContain('LINEAR.CONFLICTS.OPEN_TASK');
		expect(due.querySelector('[data-test="platform-value"]')?.textContent).toContain('2026');
		expect(el.querySelectorAll('[data-test^="keep-external-"]').length).toBe(3);
	});

	it('nothing open: says so', () => {
		api.conflicts.mockReturnValue(of([]));
		const { find } = render();
		expect(find('no-conflicts')?.textContent).toContain('LINEAR.CONFLICTS.EMPTY');
		expect(find('conflict-list')).toBeNull();
	});

	it("keeps Linear's value: the conflict leaves the list with a notice", () => {
		api.conflicts.mockReturnValue(of([conflict(), conflict({ id: 'c-2', field: 'status' })]));
		api.resolveConflict.mockReturnValue(of(conflict({ status: 'resolved', resolution: 'kept_external' })));
		const { fixture, find } = render();

		find('keep-external-c-1')?.click();
		fixture.detectChanges();

		expect(api.resolveConflict).toHaveBeenCalledWith('int-1', 'c-1', 'external');
		expect(find('conflict-c-1')).toBeNull();
		expect(find('conflict-c-2')).not.toBeNull();
		expect(find('conflicts-notice')?.textContent).toContain('LINEAR.CONFLICTS.KEPT_EXTERNAL');
	});

	it("restores the task's value; while it runs, nothing else can be resolved", () => {
		api.conflicts.mockReturnValue(of([conflict(), conflict({ id: 'c-2' })]));
		const pending = new Subject<LinearConflict>();
		api.resolveConflict.mockReturnValue(pending);
		const { fixture, find } = render();

		find('keep-platform-c-1')?.click();
		fixture.detectChanges();
		expect(api.resolveConflict).toHaveBeenCalledWith('int-1', 'c-1', 'platform');
		expect((find('keep-external-c-2') as HTMLButtonElement).disabled).toBe(true);

		pending.next(conflict({ status: 'resolved', resolution: 'kept_platform' }));
		pending.complete();
		fixture.detectChanges();
		expect(find('conflict-c-1')).toBeNull();
		expect(find('conflicts-notice')?.textContent).toContain('LINEAR.CONFLICTS.KEPT_PLATFORM');
		expect((find('keep-external-c-2') as HTMLButtonElement).disabled).toBe(false);
	});

	it('the task changed since (409): says why and keeps the conflict', () => {
		api.conflicts.mockReturnValue(of([conflict()]));
		api.resolveConflict.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Stale', code: 'LINEAR_CONFLICT_STALE' } })));
		const { fixture, find } = render();

		find('keep-platform-c-1')?.click();
		fixture.detectChanges();

		expect(find('conflicts-error')?.textContent).toContain('LINEAR.CONFLICTS.ERRORS.STALE');
		expect(find('conflict-c-1')).not.toBeNull();
		expect(api.conflicts).toHaveBeenCalledTimes(1);
	});

	it('resolved elsewhere already (404): says so and reads the list again', () => {
		api.conflicts.mockReturnValueOnce(of([conflict()])).mockReturnValueOnce(of([]));
		api.resolveConflict.mockReturnValue(throwError(() => ({ status: 404, error: { message: 'Gone', code: 'LINEAR_CONFLICT_NOT_FOUND' } })));
		const { fixture, find } = render();

		find('keep-external-c-1')?.click();
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenCalledTimes(2);
		expect(find('conflicts-error')?.textContent).toContain('LINEAR.CONFLICTS.ERRORS.NOT_FOUND');
		expect(find('no-conflicts')).not.toBeNull();
	});

	it('another refusal shows the API message', () => {
		api.conflicts.mockReturnValue(of([conflict()]));
		api.resolveConflict.mockReturnValue(throwError(() => ({ status: 403, error: { message: 'Forbidden resource' } })));
		const { fixture, find } = render();

		find('keep-external-c-1')?.click();
		fixture.detectChanges();

		expect(find('conflicts-error')?.textContent).toContain('Forbidden resource');
	});

	it("one run's conflicts: filtered by the run, and Show all clears the filter", () => {
		api.conflicts.mockReturnValue(of([conflict()]));
		const { fixture, component, find } = render({ runId: 'run-1' });
		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: 'run-1' });
		const cleared = jest.fn();
		component.runIdChange.subscribe(cleared);

		find('clear-run')?.click();
		expect(cleared).toHaveBeenCalledWith(null);

		fixture.componentRef.setInput('runId', null);
		fixture.detectChanges();
		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'open', runId: null });
		expect(find('run-filter')).toBeNull();
	});

	it('the resolved ones: how each ended, no resolve buttons', () => {
		api.conflicts
			.mockReturnValueOnce(of([conflict()]))
			.mockReturnValueOnce(of([conflict({ status: 'resolved', resolution: 'superseded', resolvedAt: '2026-11-11T09:00:00.000Z' })]));
		const { fixture, component, find } = render();

		component.changeStatus('resolved');
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'resolved', runId: null });
		expect(find('resolution')?.textContent).toContain('LINEAR.CONFLICTS.RESOLUTIONS.superseded');
		expect(find('keep-external-c-1')).toBeNull();
		// The titles already read are not read again.
		expect(api.taskTitle).toHaveBeenCalledTimes(1);
	});

	it('the list cannot be read: shows the error', () => {
		api.conflicts.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'Down' } })));
		const { find } = render();
		expect(find('conflicts-error')?.textContent).toContain('Down');
	});
});
