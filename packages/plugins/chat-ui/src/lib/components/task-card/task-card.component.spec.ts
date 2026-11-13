// The ui-core barrel boots half the app (and needs packages this spec does not): what the card names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { IChatTaskUpdateResult, PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ChatTaskSummary } from '../../chat-tasks';
import { ChatTasksService } from '../../services/chat-tasks.service';
import { ChatUiService } from '../../services/chat-ui.service';
import { TaskCardComponent } from './task-card.component';

const person = (employeeId: string, name: string) => ({ employeeId, userId: `u-${employeeId}`, name, imageUrl: null });
const PEOPLE = {
	byEmployee: new Map([['e1', person('e1', 'Anna')], ['e2', person('e2', 'Ben')]]),
	byUser: new Map(),
	list: [person('e1', 'Anna'), person('e2', 'Ben')]
};
const TASK: ChatTaskSummary = { id: 't1', key: 'GZ-7', title: 'Fix login', status: 'Open', statusId: 's1', priority: 'high', assigneeIds: ['e1'], projectId: 'p1', organizationId: 'o1' };

describe('TaskCardComponent', () => {
	let fixture: ComponentFixture<TaskCardComponent>;
	let granted: Set<string>;
	let updateTask: jest.Mock;
	let tasks: { statusChoices: jest.Mock; reload: jest.Mock };

	beforeEach(async () => {
		granted = new Set<string>([PermissionsEnum.ORG_TASK_EDIT]);
		updateTask = jest.fn(() => of({ task: { id: 't1' }, events: [] } as unknown as IChatTaskUpdateResult));
		tasks = {
			statusChoices: jest.fn(() => of([{ name: 'Open', id: 's1' }, { name: 'Done', id: 's2' }])),
			reload: jest.fn(() => of(TASK))
		};
		await TestBed.configureTestingModule({
			imports: [TaskCardComponent],
			providers: [
				{ provide: ChatUiService, useValue: { updateTask } },
				{ provide: ChatTasksService, useValue: tasks },
				{ provide: Store, useValue: { hasPermission: (permission: string) => granted.has(permission) } }
			]
		}).compileComponents();
		fixture = TestBed.createComponent(TaskCardComponent);
		fixture.componentRef.setInput('messageId', 'm1');
		fixture.componentRef.setInput('taskId', 't1');
		fixture.componentRef.setInput('people', PEOPLE);
		fixture.componentRef.setInput('summary', TASK);
		fixture.componentRef.setInput('editable', true);
		fixture.detectChanges();
	});

	const element = (): HTMLElement => fixture.nativeElement;
	const select = (test: string): HTMLSelectElement | null => element().querySelector(`[data-test="${test}"]`);
	function pick(test: string, value: string): void {
		const control = select(test) as HTMLSelectElement;
		control.value = value;
		control.dispatchEvent(new Event('change'));
		fixture.detectChanges();
	}

	it('shows the task and opens it, its key and title on the link', () => {
		const link = element().querySelector('a.task-main') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toContain('t1');
		expect(link.textContent).toContain('GZ-7');
		expect(link.textContent).toContain('Fix login');
	});

	it("offers the project's statuses, the priorities and the people to a reader who may change tasks", () => {
		expect(tasks.statusChoices).toHaveBeenCalledWith(TASK);
		expect([...(select('task-status')?.options ?? [])].map((option) => option.value)).toEqual(['Open', 'Done']);
		expect(select('task-status')?.value).toBe('Open');
		expect(select('task-priority')?.value).toBe('high');
		expect([...(select('task-assignee')?.options ?? [])].map((option) => option.textContent?.trim())).toEqual(['CHAT.TASKS.ASSIGNED', '✓ Anna', 'Ben']);
	});

	it('changes the status with its record, then reads the whole task again (the answer may lack its assignees)', () => {
		pick('task-status', 'Done');
		expect(updateTask).toHaveBeenCalledWith('m1', 't1', { status: 'Done', taskStatusId: 's2' });
		expect(tasks.reload).toHaveBeenCalledWith('t1');
	});

	it('takes no other change until the task was read again, so an assignee pick sends the stored list', () => {
		const read = new Subject<ChatTaskSummary>();
		tasks.reload.mockReturnValueOnce(read);
		pick('task-status', 'Done');
		expect(select('task-assignee')?.disabled).toBe(true);
		read.next(TASK);
		read.complete();
		fixture.detectChanges();
		expect(select('task-assignee')?.disabled).toBe(false);
	});

	it('keeps the controls held after a change it could not read again, and offers to read again', () => {
		// The change went through; the read after it failed (a passing failure answers undefined).
		tasks.reload.mockReturnValueOnce(of(undefined));
		pick('task-assignee', 'e2');
		expect(updateTask).toHaveBeenCalledWith('m1', 't1', { assigneeEmployeeIds: ['e1', 'e2'] });
		// What the card holds may be older than what is stored: no change until a read succeeds.
		expect(select('task-assignee')?.disabled).toBe(true);
		expect(element().querySelector('[data-test="task-unsynced"]')?.textContent).toContain('CHAT.TASKS.READ_FAILED');
		(element().querySelector('[data-test="task-retry"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(tasks.reload).toHaveBeenCalledTimes(2);
		expect(select('task-assignee')?.disabled).toBe(false);
		expect(element().querySelector('[data-test="task-unsynced"]')).toBeNull();
	});

	it('clears the priority, and adds or takes off one assignee at a time', () => {
		pick('task-priority', '');
		expect(updateTask).toHaveBeenLastCalledWith('m1', 't1', { priority: null });
		pick('task-assignee', 'e2');
		expect(updateTask).toHaveBeenLastCalledWith('m1', 't1', { assigneeEmployeeIds: ['e1', 'e2'] });
		// The list goes back to its count after each pick.
		expect(select('task-assignee')?.value).toBe('');
		pick('task-assignee', 'e1');
		expect(updateTask).toHaveBeenLastCalledWith('m1', 't1', { assigneeEmployeeIds: [] });
	});

	it("shows the platform's refusal and reads the task again", () => {
		updateTask.mockReturnValueOnce(throwError(() => ({ status: 403, error: { message: 'Changing a task needs ORG_TASK_EDIT.' } })));
		pick('task-status', 'Done');
		expect(element().querySelector('[data-test="task-error"]')?.textContent).toContain('Changing a task needs ORG_TASK_EDIT.');
		expect(tasks.reload).toHaveBeenCalledWith('t1');
	});

	it('keeps the controls still while a change is saved', () => {
		const answer = new Subject<IChatTaskUpdateResult>();
		updateTask.mockReturnValueOnce(answer);
		pick('task-status', 'Done');
		expect(select('task-status')?.disabled).toBe(true);
		answer.next({ task: { id: 't1' }, events: [] } as unknown as IChatTaskUpdateResult);
		answer.complete();
		fixture.detectChanges();
		expect(select('task-status')?.disabled).toBe(false);
	});

	it('shows the status only, to a reader who may not change tasks or where the message cannot be written to', () => {
		granted.clear();
		fixture.componentRef.setInput('summary', { ...TASK });
		fixture.detectChanges();
		expect(select('task-status')).toBeNull();
		expect(element().querySelector('.task-status')?.textContent).toContain('Open');

		granted.add(PermissionsEnum.ALL_ORG_EDIT);
		fixture.componentRef.setInput('editable', false);
		fixture.componentRef.setInput('summary', { ...TASK });
		fixture.detectChanges();
		expect(select('task-status')).toBeNull();
	});

	it('names a task the reader may not see by its id, with nothing to change', () => {
		fixture.componentRef.setInput('summary', null);
		fixture.detectChanges();
		expect(element().textContent).toContain('CHAT.MESSAGE.TASK');
		expect(element().textContent).toContain('t1');
		expect(select('task-status')).toBeNull();
	});
});
