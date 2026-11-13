import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { LinearConflict, LinearUiService, TASK_TITLES_MAX } from '../../services/linear-ui.service';
import { CONFLICTS_MAX, CONFLICTS_PAGE, LinearConflictsComponent } from './linear-conflicts.component';

function conflict(overrides: Partial<LinearConflict> = {}): LinearConflict {
	return {
		id: 'c-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
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

const page = (count: number) => Array.from({ length: count }, (_, index) => conflict({ id: `c-${index}`, taskId: `task-${index % 3}` }));

/** The conflict list: what changed on both sides, and the two ways to resolve it. */
describe('LinearConflictsComponent', () => {
	const api = { conflicts: jest.fn(), resolveConflict: jest.fn(), taskTitles: jest.fn() };

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
		api.taskTitles.mockReturnValue(of({ 'task-1': 'Fix login' }));
	});

	it('lists the open conflicts: the task, the field, both values, when', () => {
		api.conflicts.mockReturnValue(
			of([
				conflict(),
				conflict({ id: 'c-2', field: 'description', platformValue: '<p>Our <b>text</b></p>', externalValue: null }),
				conflict({ id: 'c-3', taskId: 'task-2', field: 'dueDate', platformValue: '2026-11-20T09:00:00.000Z', externalValue: '2026-11-21T09:00:00.000Z' })
			])
		);
		const { el, find } = render();

		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: null, take: CONFLICTS_PAGE });
		// One read for the titles of every task listed, in the conflicts' organization.
		expect(api.taskTitles).toHaveBeenCalledTimes(1);
		expect(api.taskTitles).toHaveBeenCalledWith({ tenantId: 'tenant-1', organizationId: 'org-1' }, ['task-1', 'task-2']);
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
		// A short list is the whole list.
		expect(find('more-conflicts')).toBeNull();
	});

	it('shows a date-only due date as its own day (the zones are covered by the utils spec)', () => {
		api.conflicts.mockReturnValue(
			of([conflict({ id: 'c-9', field: 'dueDate', platformValue: '2026-11-20', externalValue: '2026-11-21T00:00:00.000Z' })])
		);
		const { find } = render();

		const due = find('conflict-c-9') as HTMLElement;
		expect(due.querySelector('[data-test="platform-value"]')?.textContent?.trim()).toBe('Nov 20, 2026');
		expect(due.querySelector('[data-test="external-value"]')?.textContent?.trim()).toBe('Nov 21, 2026');
	});

	it('reads the titles of many tasks a few dozen at a time, as the task filter takes them', () => {
		api.conflicts.mockReturnValue(of(Array.from({ length: TASK_TITLES_MAX + 5 }, (_, index) => conflict({ id: `c-${index}`, taskId: `task-${index}` }))));
		render();
		expect(api.taskTitles).toHaveBeenCalledTimes(2);
		expect(api.taskTitles.mock.calls[0][1]).toHaveLength(TASK_TITLES_MAX);
		expect(api.taskTitles.mock.calls[1][1]).toEqual(Array.from({ length: 5 }, (_, index) => `task-${TASK_TITLES_MAX + index}`));
	});

	it('titles that could not be read are asked again on the next read of the list', () => {
		api.conflicts.mockReturnValue(of([conflict()]));
		api.taskTitles.mockReturnValueOnce(of(null)).mockReturnValue(of({ 'task-1': 'Fix login' }));
		const { fixture, component, find } = render();
		expect(find('conflict-c-1')?.querySelector('[data-test="task"]')?.textContent).toContain('LINEAR.CONFLICTS.OPEN_TASK');

		component.load();
		fixture.detectChanges();

		expect(api.taskTitles).toHaveBeenCalledTimes(2);
		expect(find('conflict-c-1')?.querySelector('[data-test="task"]')?.textContent).toContain('Fix login');
	});

	it('a long value is cut, and shown whole on request (no tooltip needed)', () => {
		const long = 'word '.repeat(80).trim();
		api.conflicts.mockReturnValue(of([conflict({ field: 'description', platformValue: long })]));
		const { fixture, find } = render();
		const cell = () => find('conflict-c-1')?.querySelector('[data-test="platform-value"] .text')?.textContent ?? '';

		expect(cell().length).toBeLessThan(long.length);
		const toggle = find('conflict-c-1')?.querySelector('[data-test="platform-toggle"]') as HTMLButtonElement;
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(find('conflict-c-1')?.querySelector('[data-test="external-toggle"]')).toBeNull();

		toggle.click();
		fixture.detectChanges();
		expect(cell()).toBe(long);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(toggle.textContent).toContain('LINEAR.CONFLICTS.SHOW_LESS');
	});

	it('nothing open: says so', () => {
		api.conflicts.mockReturnValue(of([]));
		const { find } = render();
		expect(find('no-conflicts')?.textContent).toContain('LINEAR.CONFLICTS.EMPTY');
		expect(find('conflict-list')).toBeNull();
		expect(api.taskTitles).not.toHaveBeenCalled();
	});

	it("keeps Linear's value: the conflict leaves the list, a notice says so, and the list is read again", () => {
		api.conflicts.mockReturnValueOnce(of([conflict(), conflict({ id: 'c-2', field: 'status' })])).mockReturnValue(of([conflict({ id: 'c-2', field: 'status' }), conflict({ id: 'c-9' })]));
		api.resolveConflict.mockReturnValue(of(conflict({ status: 'resolved', resolution: 'kept_external' })));
		const { fixture, find } = render();

		find('keep-external-c-1')?.click();
		fixture.detectChanges();

		expect(api.resolveConflict).toHaveBeenCalledWith('int-1', 'c-1', 'external');
		expect(find('conflict-c-1')).toBeNull();
		expect(find('conflict-c-2')).not.toBeNull();
		// The next older one comes up.
		expect(api.conflicts).toHaveBeenCalledTimes(2);
		expect(find('conflict-c-9')).not.toBeNull();
		expect(find('conflicts-notice')?.textContent).toContain('LINEAR.CONFLICTS.KEPT_EXTERNAL');
		// The titles already read are not read again.
		expect(api.taskTitles).toHaveBeenCalledTimes(1);
	});

	it("restores the task's value; while it runs, nothing else can be resolved or read again", () => {
		api.conflicts.mockReturnValue(of([conflict(), conflict({ id: 'c-2' })]));
		const pending = new Subject<LinearConflict>();
		api.resolveConflict.mockReturnValue(pending);
		const { fixture, find } = render();

		find('keep-platform-c-1')?.click();
		fixture.detectChanges();
		expect(api.resolveConflict).toHaveBeenCalledWith('int-1', 'c-1', 'platform');
		expect((find('keep-external-c-2') as HTMLButtonElement).disabled).toBe(true);
		expect((find('refresh-conflicts') as HTMLButtonElement).disabled).toBe(true);

		api.conflicts.mockReturnValue(of([conflict({ id: 'c-2' })]));
		pending.next(conflict({ status: 'resolved', resolution: 'kept_platform' }));
		pending.complete();
		fixture.detectChanges();
		expect(find('conflict-c-1')).toBeNull();
		expect(find('conflicts-notice')?.textContent).toContain('LINEAR.CONFLICTS.KEPT_PLATFORM');
		expect((find('keep-external-c-2') as HTMLButtonElement).disabled).toBe(false);
	});

	it('a read in flight when a resolve lands never brings the resolved conflict back', () => {
		const stale = new Subject<LinearConflict[]>();
		api.conflicts.mockReturnValueOnce(of([conflict(), conflict({ id: 'c-2' })])).mockReturnValueOnce(stale).mockReturnValue(of([conflict({ id: 'c-2' })]));
		api.resolveConflict.mockReturnValue(of(conflict({ status: 'resolved' })));
		const { fixture, component, find } = render();

		component.load();
		find('keep-external-c-1')?.click();
		fixture.detectChanges();
		// The older read answers late, with the conflict still open: it was dropped.
		stale.next([conflict(), conflict({ id: 'c-2' })]);
		fixture.detectChanges();

		expect(find('conflict-c-1')).toBeNull();
		expect(stale.observed).toBe(false);
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

	it('a full page offers the older ones, up to the route limit', () => {
		api.conflicts.mockReturnValueOnce(of(page(CONFLICTS_PAGE))).mockReturnValue(of(page(CONFLICTS_PAGE + 10)));
		const { fixture, component, find } = render();

		find('more-conflicts')?.click();
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'open', runId: null, take: CONFLICTS_PAGE * 2 });
		expect(find('conflict-c-59')).not.toBeNull();
		// Fewer than asked: that is all of them.
		expect(find('more-conflicts')).toBeNull();

		component.take = CONFLICTS_MAX;
		component.rows = page(CONFLICTS_MAX).map((item) => ({ conflict: item }) as never);
		expect(component.canShowMore).toBe(false);
	});

	it("one run's conflicts: filtered by the run, and Show all clears the filter", () => {
		api.conflicts.mockReturnValue(of([conflict()]));
		const { fixture, component, find } = render({ runId: 'run-1' });
		expect(api.conflicts).toHaveBeenCalledWith('int-1', { status: 'open', runId: 'run-1', take: CONFLICTS_PAGE });
		const cleared = jest.fn();
		component.runIdChange.subscribe(cleared);

		find('clear-run')?.click();
		expect(cleared).toHaveBeenCalledWith(null);

		fixture.componentRef.setInput('runId', null);
		fixture.detectChanges();
		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'open', runId: null, take: CONFLICTS_PAGE });
		expect(find('run-filter')).toBeNull();
	});

	it('the resolved ones: how each ended, no resolve buttons', () => {
		api.conflicts
			.mockReturnValueOnce(of([conflict()]))
			.mockReturnValueOnce(of([conflict({ status: 'resolved', resolution: 'superseded', resolvedAt: '2026-11-11T09:00:00.000Z' })]));
		const { fixture, component, find } = render();

		component.changeStatus('resolved');
		fixture.detectChanges();

		expect(api.conflicts).toHaveBeenLastCalledWith('int-1', { status: 'resolved', runId: null, take: CONFLICTS_PAGE });
		expect(find('resolution')?.textContent).toContain('LINEAR.CONFLICTS.RESOLUTIONS.superseded');
		expect(find('keep-external-c-1')).toBeNull();
		expect(api.taskTitles).toHaveBeenCalledTimes(1);
	});

	it('the list cannot be read: shows the error', () => {
		api.conflicts.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'Down' } })));
		const { find } = render();
		expect(find('conflicts-error')?.textContent).toContain('Down');
	});
});
