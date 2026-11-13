import { ComponentFixture, TestBed } from '@angular/core/testing';
import { runInThisContext } from 'node:vm';
import { ID, ITask } from '@gauzy/contracts';
import { initialsOf, isOverdue, RowToggle, TaskListComponent, TaskRowGroup } from './task-list.component';

const row = (id: string, extra: Partial<ITask> = {}) =>
	({ id, title: `Task ${id}`, number: 1, project: { taskKey: 'API' }, ...extra }) as ITask;

describe('TaskListComponent', () => {
	let fixture: ComponentFixture<TaskListComponent>;
	let toggles: RowToggle[];
	let opened: ID[];
	const host = () => fixture.nativeElement as HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [TaskListComponent] }).compileComponents();
		fixture = TestBed.createComponent(TaskListComponent);
		toggles = [];
		opened = [];
		fixture.componentInstance.toggled.subscribe((toggle) => toggles.push(toggle));
		fixture.componentInstance.opened.subscribe((id) => opened.push(id));
	});

	function render(groups: TaskRowGroup[], grouped = false, extra: Record<string, unknown> = {}) {
		fixture.componentRef.setInput('groups', groups);
		fixture.componentRef.setInput('grouped', grouped);
		fixture.componentRef.setInput('shown', { reference: true, status: true, dueDate: true });
		for (const [name, value] of Object.entries(extra)) fixture.componentRef.setInput(name, value);
		fixture.detectChanges();
	}

	it('shows each row with its KEY-123 reference', () => {
		render([
			{
				key: '',
				label: '',
				count: null,
				rows: [row('a', { number: 42 }), row('b', { number: 7, project: null as never, prefix: 'Ful' })]
			}
		]);
		const references = Array.from(host().querySelectorAll('[data-test="row-reference"]')).map((cell) =>
			cell.textContent?.trim()
		);
		expect(references).toEqual(['API-42', 'Ful-7']);
	});

	it('toggles a row from its checkbox, Shift held for a range, and opens it from its title', () => {
		render([{ key: '', label: '', count: null, rows: [row('a'), row('b')] }]);
		const boxes = host().querySelectorAll('[data-test="select-row"]');
		(boxes[0] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
		(boxes[1] as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
		expect(toggles).toEqual([
			{ id: 'a', shift: false },
			{ id: 'b', shift: true }
		]);
		(host().querySelector('.title-link') as HTMLElement).click();
		expect(opened).toEqual(['a']);
	});

	it('heads each group with the platform count and what is loaded of it', () => {
		render(
			[
				{ key: 's1', label: 'open', count: 5, rows: [row('a')] },
				{ key: '', label: '', count: 1, rows: [row('b')] }
			],
			true
		);
		const heads = host().querySelectorAll('[data-test="group-head"]');
		expect(heads.length).toBe(2);
		expect(heads[0].textContent).toContain('open');
		expect(heads[0].textContent).toContain('5');
		expect(heads[0].textContent).toContain('TASK_VIEWS.GROUP.LOADED');
		expect(heads[1].textContent).toContain('TASK_VIEWS.GROUP.NO_VALUE');
	});

	it('asks the page to select or unselect the whole page', () => {
		const pages: boolean[] = [];
		fixture.componentInstance.pageToggled.subscribe((select) => pages.push(select));
		render([{ key: '', label: '', count: null, rows: [row('a')] }], false, {
			selection: { ids: ['a'], anchor: 'a' }
		});
		(host().querySelector('[data-test="select-page"]') as HTMLElement).click();
		expect(pages).toEqual([false]);
	});

	it('shows a date-only due date as its own day to a reader west of UTC, and a moment in the reader’s zone', () => {
		// Jest hands each test file a copy of `process.env`: Node reads the host process's `env.TZ`.
		const hostProcess = runInThisContext('process') as NodeJS.Process;
		const previous = hostProcess.env['TZ'];
		const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
		// UTC−4: midnight UTC is the evening before here.
		hostProcess.env['TZ'] = 'America/Caracas';
		try {
			expect(new Date(2026, 10, 14).getTimezoneOffset()).toBe(240);
			render([
				{
					key: '',
					label: '',
					count: null,
					rows: [
						row('a', { dueDate: '2026-11-14T00:00:00.000Z' as never }),
						row('b', { dueDate: '2026-11-15T03:59:59.000Z' as never })
					]
				}
			]);
			const days = Array.from(host().querySelectorAll('.cell.due[role="gridcell"]')).map((cell) =>
				cell.textContent?.trim()
			);
			expect(days).toEqual(['Nov 14, 2026', 'Nov 14, 2026']);
		} finally {
			hostProcess.env['TZ'] = previous ?? current;
			if (previous === undefined) delete hostProcess.env['TZ'];
		}
	});

	it('marks a passed due date of an open task, and draws initials', () => {
		expect(isOverdue({ dueDate: new Date(2000, 1, 1), status: 'open' as never })).toBe(true);
		expect(isOverdue({ dueDate: new Date(2000, 1, 1), status: 'done' as never })).toBe(false);
		expect(isOverdue({ dueDate: undefined })).toBe(false);
		expect(initialsOf('Ada Lovelace')).toBe('AL');
		expect(initialsOf('Plato')).toBe('PL');
	});
});
