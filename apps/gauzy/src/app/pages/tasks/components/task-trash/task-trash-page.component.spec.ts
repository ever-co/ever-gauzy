// The services the page injects, as DI tokens: the real barrel pulls the whole app (cookies, auth) into the test.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	TaskTrashService: class TaskTrashService {},
	ToastrService: class ToastrService {},
	TASK_TRASH_PAGE_SIZE: 50
}));

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { IOrganization, IOrganizationProject } from '@gauzy/contracts';
import { Store, TaskTrashService, ToastrService } from '@gauzy/ui-core/core';
import {
	deletedByOf,
	isNoLongerInTrash,
	taskKeyOf,
	TaskTrashPageComponent,
	trashStateOf
} from './task-trash-page.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;

const trashed = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	title: `Task ${id}`,
	number: 7,
	prefix: 'API',
	deletedAt: '2026-11-10T08:00:00.000Z',
	deletedByUser: { firstName: 'Ann', lastName: 'Lee' },
	project: { name: 'Website' },
	...extra
});

/**
 * The task trash page (comments-and-trash): the organization's deleted tasks, kept to the selected project, with
 * restore and delete forever; and what it says when the platform keeps no trash or the reader may not list it.
 */
describe('TaskTrashPageComponent', () => {
	let organization$: BehaviorSubject<IOrganization | null>;
	let project$: BehaviorSubject<IOrganizationProject | null>;
	let trash: { list: jest.Mock; restore: jest.Mock; deleteForever: jest.Mock };
	let toastr: { success: jest.Mock; warning: jest.Mock; danger: jest.Mock };

	beforeEach(() => {
		organization$ = new BehaviorSubject<IOrganization | null>(ORGANIZATION);
		project$ = new BehaviorSubject<IOrganizationProject | null>(null);
		trash = {
			list: jest.fn(async () => ({ items: [trashed('t1'), trashed('t2', { deletedByUser: null })], total: 3 })),
			restore: jest.fn(async () => undefined),
			deleteForever: jest.fn(async () => undefined)
		};
		toastr = { success: jest.fn(), warning: jest.fn(), danger: jest.fn() };
		TestBed.configureTestingModule({
			imports: [TaskTrashPageComponent],
			providers: [
				provideRouter([]),
				{ provide: Store, useValue: { selectedOrganization$: organization$, selectedProject$: project$ } },
				{ provide: TaskTrashService, useValue: trash },
				{ provide: ToastrService, useValue: toastr }
			]
		});
	});

	const render = async (): Promise<ComponentFixture<TaskTrashPageComponent>> => {
		jest.useFakeTimers();
		const fixture = TestBed.createComponent(TaskTrashPageComponent);
		fixture.detectChanges();
		// The search box is debounced.
		jest.advanceTimersByTime(400);
		jest.useRealTimers();
		await fixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve));
		fixture.detectChanges();
		return fixture;
	};
	const element = (fixture: ComponentFixture<TaskTrashPageComponent>): HTMLElement => fixture.nativeElement;
	const rowIds = (fixture: ComponentFixture<TaskTrashPageComponent>) =>
		Array.from(element(fixture).querySelectorAll('.task-trash__row')).map((row) => row.getAttribute('data-task-id'));
	const state = (fixture: ComponentFixture<TaskTrashPageComponent>): any => fixture.componentInstance;

	afterEach(() => jest.useRealTimers());

	it('lists the organization’s trash, most recently deleted first, with who deleted each task', async () => {
		const fixture = await render();

		expect(trash.list).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: 'org-1', tenantId: 'tenant-1', skip: 0, search: '' })
		);
		expect(trash.list.mock.calls[0][0].projectId).toBeUndefined();
		expect(rowIds(fixture)).toEqual(['t1', 't2']);
		expect(element(fixture).querySelector('.task-trash__key')?.textContent.trim()).toBe('API-7');
		expect(element(fixture).querySelectorAll('.task-trash__meta')[0].textContent).toContain('TASKS_PAGE.TRASH.DELETED_BY');
		expect(element(fixture).querySelectorAll('.task-trash__meta')[1].textContent).toContain('TASKS_PAGE.TRASH.DELETED_AT');
	});

	it('keeps the list to the selected project, and reads the next page after the rows shown', async () => {
		project$.next({ id: 'project-1' } as IOrganizationProject);
		const fixture = await render();
		expect(trash.list.mock.calls.at(-1)[0]).toMatchObject({ projectId: 'project-1' });

		trash.list.mockResolvedValueOnce({ items: [trashed('t3')], total: 3 });
		await state(fixture).load(false);
		fixture.detectChanges();

		expect(trash.list.mock.calls.at(-1)[0]).toMatchObject({ skip: 2 });
		expect(rowIds(fixture)).toEqual(['t1', 't2', 't3']);
	});

	it('restores a task: it leaves the list and the reader is told', async () => {
		const fixture = await render();

		await state(fixture).restore(state(fixture).rows[0]);
		fixture.detectChanges();

		expect(trash.restore).toHaveBeenCalledWith('t1');
		expect(rowIds(fixture)).toEqual(['t2']);
		expect(toastr.success).toHaveBeenCalledWith('TASKS_PAGE.TRASH.RESTORED');
	});

	it('asks before deleting a task for good, then deletes it', async () => {
		const fixture = await render();
		const row = () => element(fixture).querySelector<HTMLElement>('.task-trash__row[data-task-id="t2"]');

		row()?.querySelector<HTMLButtonElement>('.task-trash__ask-delete')?.click();
		fixture.detectChanges();
		expect(trash.deleteForever).not.toHaveBeenCalled();
		expect(row()?.querySelector('.task-trash__confirm')).not.toBeNull();

		row()?.querySelector<HTMLButtonElement>('.task-trash__confirm-delete')?.click();
		await fixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve));
		fixture.detectChanges();

		expect(trash.deleteForever).toHaveBeenCalledTimes(1);
		// From the organization's trash only: the platform deletes it only while it is still there.
		expect(trash.deleteForever).toHaveBeenCalledWith('t2', 'org-1', 'tenant-1');
		expect(rowIds(fixture)).toEqual(['t1']);
		expect(state(fixture).confirmingId).toBeNull();
		expect(toastr.success).toHaveBeenCalledWith('TASKS_PAGE.TRASH.DELETED_FOREVER');
	});

	it('says a task is no longer in the trash when someone restored or deleted it meanwhile, and reads the list again', async () => {
		const fixture = await render();
		trash.deleteForever.mockRejectedValue({ status: 404, error: { message: 'TASK_NOT_IN_TRASH' } });
		// The list as it is now: the restored task is gone from it.
		trash.list.mockResolvedValueOnce({ items: [trashed('t2')], total: 1 });
		state(fixture).confirmingId = 't1';

		await state(fixture).deleteForever(state(fixture).rows[0]);
		await fixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve));
		fixture.detectChanges();

		expect(toastr.warning).toHaveBeenCalledWith('TASKS_PAGE.TRASH.NO_LONGER_IN_TRASH');
		expect(toastr.danger).not.toHaveBeenCalled();
		expect(toastr.success).not.toHaveBeenCalled();
		expect(trash.list).toHaveBeenCalledTimes(2);
		expect(trash.list.mock.calls[1][0]).toMatchObject({ organizationId: 'org-1', skip: 0 });
		expect(rowIds(fixture)).toEqual(['t2']);
		expect(state(fixture).total).toBe(1);
		expect(state(fixture).busyId).toBeNull();
		expect(state(fixture).confirmingId).toBeNull();
	});

	it('keeps a task and says why when a delete fails otherwise, without reading the list again', async () => {
		const fixture = await render();
		trash.deleteForever.mockRejectedValue({ status: 403, error: { message: 'Only a manager' } });

		await state(fixture).deleteForever(state(fixture).rows[0]);
		fixture.detectChanges();

		expect(toastr.danger).toHaveBeenCalledWith('Only a manager', 'TOASTR.TITLE.ERROR');
		expect(toastr.warning).not.toHaveBeenCalled();
		expect(trash.list).toHaveBeenCalledTimes(1);
		expect(rowIds(fixture)).toEqual(['t1', 't2']);
	});

	it('runs one restore or delete at a time, and disables the row’s buttons while it runs', async () => {
		const fixture = await render();
		let finish: () => void = () => undefined;
		trash.deleteForever.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		state(fixture).confirmingId = 't1';
		fixture.detectChanges();

		const deleting = state(fixture).deleteForever(state(fixture).rows[0]);
		fixture.detectChanges();
		expect(state(fixture).busyId).toBe('t1');
		const confirm = element(fixture).querySelector<HTMLButtonElement>(
			'.task-trash__row[data-task-id="t1"] .task-trash__confirm-delete'
		);
		expect(confirm?.disabled).toBe(true);

		await state(fixture).deleteForever(state(fixture).rows[1]);
		await state(fixture).restore(state(fixture).rows[1]);
		expect(trash.deleteForever).toHaveBeenCalledTimes(1);
		expect(trash.restore).not.toHaveBeenCalled();

		finish();
		await deleting;
		expect(state(fixture).busyId).toBeNull();
	});

	it('reads the list again when a restore ends while a read is under way, so the task cannot come back', async () => {
		const fixture = await render();
		let answer: (page: unknown) => void = () => undefined;
		trash.list
			.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
			.mockResolvedValueOnce({ items: [trashed('t2')], total: 1 });

		const stale = state(fixture).load(true);
		await state(fixture).restore(state(fixture).rows[0]);
		// The read that started before the restore answers with the restored task still in it.
		answer({ items: [trashed('t1'), trashed('t2')], total: 2 });
		await stale;
		await fixture.whenStable();
		await new Promise((resolve) => setTimeout(resolve));
		fixture.detectChanges();

		expect(rowIds(fixture)).toEqual(['t2']);
		expect(state(fixture).total).toBe(1);
	});

	it('leaves a list read meanwhile as it is when it does not hold the restored task', async () => {
		const fixture = await render();
		let finish: () => void = () => undefined;
		trash.restore.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		const restoring = state(fixture).restore(state(fixture).rows[0]);

		// Another project's trash is read while the restore runs: 50 of 51 shown, Load more must stay.
		trash.list.mockResolvedValueOnce({ items: [trashed('p1'), trashed('p2')], total: 51 });
		await state(fixture).load(true);
		finish();
		await restoring;
		fixture.detectChanges();

		expect(rowIds(fixture)).toEqual(['p1', 'p2']);
		expect(state(fixture).total).toBe(51);
	});

	it('keeps a task and says so when the platform refuses the restore', async () => {
		trash.restore.mockRejectedValue({ status: 403, error: { message: 'Only a manager' } });
		const fixture = await render();

		await state(fixture).restore(state(fixture).rows[0]);
		fixture.detectChanges();

		expect(rowIds(fixture)).toEqual(['t1', 't2']);
		expect(toastr.danger).toHaveBeenCalledWith('Only a manager', 'TOASTR.TITLE.ERROR');
	});

	it('says the trash is not available on a platform that keeps none', async () => {
		trash.list.mockRejectedValue({ status: 404 });
		const fixture = await render();

		expect(state(fixture).state).toBe('unavailable');
		expect(element(fixture).textContent).toContain('TASKS_PAGE.TRASH.UNAVAILABLE_TITLE');
	});
});

describe('task trash helpers', () => {
	it('reads the platform’s answer as the page’s state', () => {
		expect(trashStateOf({ status: 404 })).toBe('unavailable');
		expect(trashStateOf({ status: 403 })).toBe('forbidden');
		expect(trashStateOf({ status: 500 })).toBe('error');
	});

	it('reads a 404 to a Delete forever as a task that is no longer in the trash', () => {
		expect(isNoLongerInTrash({ status: 404 })).toBe(true);
		expect(isNoLongerInTrash({ status: 403 })).toBe(false);
		expect(isNoLongerInTrash({ status: 500 })).toBe(false);
		expect(isNoLongerInTrash(undefined)).toBe(false);
	});

	it('shows the task key and who deleted it', () => {
		expect(taskKeyOf({ taskNumber: 'API-42' })).toBe('API-42');
		expect(taskKeyOf({ prefix: 'API', number: 42 })).toBe('API-42');
		expect(taskKeyOf({ number: 3 })).toBe('#3');
		expect(deletedByOf({ deletedByUser: { firstName: 'Ann', lastName: 'Lee' } } as never)).toBe('Ann Lee');
		expect(deletedByOf({ deletedByUser: { name: 'ann' } } as never)).toBe('ann');
		expect(deletedByOf({} as never)).toBe('');
	});
});
