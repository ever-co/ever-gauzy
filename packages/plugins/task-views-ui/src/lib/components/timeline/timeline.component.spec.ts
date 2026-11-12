import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ID, ITask } from '@gauzy/contracts';
import { TimelineComponent } from './timeline.component';

const task = (id: string, fields: Partial<ITask> = {}): ITask =>
	({ id: id as ID, title: `Task ${id}`, status: 'open', ...fields }) as ITask;

describe('TimelineComponent', () => {
	let fixture: ComponentFixture<TimelineComponent>;
	let opened: ID[];
	const host = () => fixture.nativeElement as HTMLElement;
	const bar = (id: string) => host().querySelector(`[data-test="timeline-bar-${id}"]`) as HTMLButtonElement | null;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [TimelineComponent] }).compileComponents();
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 10, 12, 10, 0));
		fixture = TestBed.createComponent(TimelineComponent);
		opened = [];
		fixture.componentInstance.opened.subscribe((id) => opened.push(id));
	});

	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});

	const show = (tasks: ITask[]) => {
		fixture.componentRef.setInput('tasks', tasks);
		fixture.detectChanges();
	};

	it('draws a bar per dated task, lists the undated ones apart, and opens a task from either', () => {
		show([
			task('a', { startDate: '2026-11-10' as never, dueDate: '2026-11-14' as never }),
			task('b'),
			task('c', { dueDate: '2026-11-20' as never })
		]);

		expect(bar('a')).toBeTruthy();
		expect(bar('c')).toBeTruthy();
		expect(bar('b')).toBeNull();
		// Weeks: 36 px a day, the five days of a's range.
		expect(bar('a')?.style.width).toBe(`${5 * 36}px`);
		const unscheduled = host().querySelector('[data-test="timeline-unscheduled"]') as HTMLElement;
		expect(unscheduled.textContent).toContain('Task b');

		bar('a')?.click();
		(host().querySelector('[data-test="timeline-title-c"]') as HTMLButtonElement).click();
		(unscheduled.querySelector('button') as HTMLButtonElement).click();
		expect(opened).toEqual(['a', 'c', 'b']);
	});

	it('names a bar by its title and its dates, and marks an overdue task and a single date', () => {
		show([
			task('late', { dueDate: '2026-11-01' as never }),
			task('done', { dueDate: '2026-11-01' as never, taskStatus: { isDone: true } as never }),
			task('range', { startDate: '2026-11-10' as never, dueDate: '2026-11-14' as never })
		]);

		expect(bar('late')?.classList).toContain('overdue');
		expect(bar('late')?.classList).toContain('single');
		expect(bar('late')?.getAttribute('aria-label')).toContain('Task late');
		expect(bar('late')?.getAttribute('aria-label')).toContain('TASK_VIEWS.TIMELINE.DUE_ONLY');
		expect(bar('late')?.getAttribute('aria-label')).toContain('TASK_VIEWS.TIMELINE.OVERDUE');
		expect(bar('done')?.classList).not.toContain('overdue');
		expect(bar('range')?.classList).not.toContain('single');
		expect(bar('range')?.getAttribute('aria-label')).toContain('TASK_VIEWS.TIMELINE.RANGE');
	});

	it('marks today, and zooms out to months', () => {
		show([task('a', { startDate: '2026-11-10' as never, dueDate: '2026-11-14' as never })]);
		expect(host().querySelector('[data-test="timeline-today"]')).toBeTruthy();

		(host().querySelector('[data-test="timeline-zoom-month"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		// Months: 10 px a day.
		expect(bar('a')?.style.width).toBe(`${5 * 10}px`);
		expect(host().querySelector('[data-test="timeline-zoom-month"]')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('says so when the view has no task', () => {
		show([]);
		expect(host().querySelector('[data-test="timeline-empty"]')).toBeTruthy();
		expect(host().querySelector('[data-test="timeline-calendar"]')).toBeNull();
	});
});
