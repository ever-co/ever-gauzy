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
import { deletedByOf, taskKeyOf, TaskTrashPageComponent, trashStateOf } from './task-trash-page.component';

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
	let toastr: { success: jest.Mock; danger: jest.Mock };

	beforeEach(() => {
		organization$ = new BehaviorSubject<IOrganization | null>(ORGANIZATION);
		project$ = new BehaviorSubject<IOrganizationProject | null>(null);
		trash = {
			list: jest.fn(async () => ({ items: [trashed('t1'), trashed('t2', { deletedByUser: null })], total: 3 })),
			restore: jest.fn(async () => undefined),
			deleteForever: jest.fn(async () => undefined)
		};
		toastr = { success: jest.fn(), danger: jest.fn() };
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
		state(fixture).confirmingId = 't2';
		fixture.detectChanges();
		expect(element(fixture).querySelector('.task-trash__confirm')).not.toBeNull();

		await state(fixture).deleteForever(state(fixture).rows[1]);
		fixture.detectChanges();

		expect(trash.deleteForever).toHaveBeenCalledWith('t2');
		expect(rowIds(fixture)).toEqual(['t1']);
		expect(state(fixture).confirmingId).toBeNull();
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

	it('shows the task key and who deleted it', () => {
		expect(taskKeyOf({ taskNumber: 'API-42' })).toBe('API-42');
		expect(taskKeyOf({ prefix: 'API', number: 42 })).toBe('API-42');
		expect(taskKeyOf({ number: 3 })).toBe('#3');
		expect(deletedByOf({ deletedByUser: { firstName: 'Ann', lastName: 'Lee' } } as never)).toBe('Ann Lee');
		expect(deletedByOf({ deletedByUser: { name: 'ann' } } as never)).toBe('ann');
		expect(deletedByOf({} as never)).toBe('');
	});
});
