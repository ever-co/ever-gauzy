import { formatDate } from '@angular/common';
import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	ElementRef,
	inject,
	input,
	LOCALE_ID,
	output,
	signal,
	viewChild
} from '@angular/core';
import { NbButtonModule } from '@nebular/theme';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ID, ITask } from '@gauzy/contracts';
import { taskReferenceOf } from '../../models/task-reference';
import {
	dateOfDayNumber,
	dayNumberOf,
	isDoneTask,
	ticksOf,
	timelineOf,
	TIMELINE_DAY_WIDTH,
	TaskTimelineBar,
	TaskTimelineZoom
} from '../../models/timeline';

/** The width of the titles column, in pixels: the calendar scrolls beside it. */
export const TIMELINE_TITLE_WIDTH = 240;

/** The narrowest bar that shows its task's title inside it. */
const TITLE_IN_BAR_WIDTH = 64;

/** Room a header label takes: the first day is labelled when the first labelled day is further than this. */
const HEADER_LABEL_WIDTH = 72;

/** One row of the timeline: the task, its bar, and what its bar is named by. */
export interface TimelineRow {
	task: ITask;
	bar: TaskTimelineBar;
	reference: string | null;
	/** The task's dates (and state) in words: the bar's name after the title, and its tooltip. */
	dates: string;
	left: number;
	width: number;
}

/** A labelled day of the header. */
export interface TimelineHeaderTick {
	left: number;
	label: string;
}

/**
 * The timeline layout of a saved view: each task as a bar from its start to its due date on a calendar of days,
 * zoomed by weeks or by months, today marked; the tasks without dates listed apart. A bar or a title opens its task.
 * The calendar follows the view's rows as loaded (the page's Load more adds to it). Read only: dates change on the
 * task's page, or for a selection from the list.
 */
@Component({
	selector: 'ngx-task-views-timeline',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NbButtonModule, TranslatePipe],
	templateUrl: './timeline.component.html',
	styleUrl: './timeline.component.scss'
})
export class TimelineComponent {
	private readonly translate = inject(TranslateService);
	private readonly locale = inject(LOCALE_ID);
	private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

	readonly tasks = input<ITask[]>([]);
	readonly opened = output<ID>();

	protected readonly titleWidth = TIMELINE_TITLE_WIDTH;
	protected readonly zoom = signal<TaskTimelineZoom>('week');
	/** Today, kept current: at midnight, and when the page shows again after being hidden. */
	protected readonly today = signal(new Date());
	/** The language, so the words of the bars follow a change of it. */
	private readonly language = this.translate.currentLang;

	protected readonly dayWidth = computed(() => TIMELINE_DAY_WIDTH[this.zoom()]);
	protected readonly timeline = computed(() =>
		timelineOf(
			this.tasks().map((task) => ({
				id: String(task.id),
				startDate: task.startDate ?? null,
				dueDate: task.dueDate ?? null,
				isDone: isDoneTask(task)
			})),
			{ today: this.today(), zoom: this.zoom() }
		)
	);
	protected readonly trackWidth = computed(() => this.timeline().dayCount * this.dayWidth());
	protected readonly todayLeft = computed(() => {
		const day = this.timeline().todayDay;
		return day === null ? null : day * this.dayWidth();
	});

	protected readonly rows = computed<TimelineRow[]>(() => {
		this.language();
		const byId = new Map(this.tasks().map((task) => [String(task.id), task]));
		const width = this.dayWidth();
		const thisYear = this.today().getFullYear();
		const rows: TimelineRow[] = [];
		for (const bar of this.timeline().bars) {
			const task = byId.get(bar.taskId);
			if (!task) continue;
			rows.push({
				task,
				bar,
				reference: taskReferenceOf(task),
				dates: this.datesOf(bar, thisYear),
				left: bar.startDay * width,
				width: Math.max(width, (bar.endDay - bar.startDay + 1) * width)
			});
		}
		return rows;
	});

	protected readonly unscheduled = computed(() => {
		const ids = new Set(this.timeline().unscheduledIds);
		return this.tasks().filter((task) => ids.has(String(task.id)));
	});

	/**
	 * The labelled days: Mondays by weeks (`Nov 9`), the first of each month by months (`Nov 2026`); and the first day
	 * drawn when the first of those is further on (a month calendar within one month still says which month it is).
	 */
	protected readonly majorTicks = computed<TimelineHeaderTick[]>(() => {
		this.language();
		const zoom = this.zoom();
		const width = this.dayWidth();
		const format = zoom === 'week' ? 'MMM d' : 'MMM y';
		const ticks = ticksOf(this.timeline(), zoom);
		const labelled = ticks
			.filter((tick) => tick.isMajor)
			.map((tick) => ({ left: tick.day * width, label: this.format(tick.date, format) }));
		if (ticks.length && (!labelled.length || labelled[0].left >= HEADER_LABEL_WIDTH)) {
			labelled.unshift({ left: 0, label: this.format(ticks[0].date, format) });
		}
		return labelled;
	});

	/** By weeks, every day's number under the labels, weekends marked. */
	protected readonly dayTicks = computed(() => {
		if (this.zoom() !== 'week') return [];
		const width = this.dayWidth();
		return ticksOf(this.timeline(), 'week').map((tick) => ({
			left: tick.day * width,
			label: String(tick.date.getDate()),
			isWeekend: tick.date.getDay() === 0 || tick.date.getDay() === 6
		}));
	});

	protected readonly isEmpty = computed(() => !this.rows().length && !this.unscheduled().length);

	/** The calendar is scrolled to today once per calendar shown (first drawn, or another zoom). */
	private scrolledFor = '';

	constructor() {
		const destroyRef = inject(DestroyRef);
		let midnight: ReturnType<typeof setTimeout> | null = null;
		const refresh = () => {
			const now = new Date();
			if (dayNumberOf(now) !== dayNumberOf(this.today())) this.today.set(now);
			const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
			if (midnight) clearTimeout(midnight);
			midnight = setTimeout(refresh, Math.max(1_000, next.getTime() - now.getTime() + 1_000));
		};
		const onVisible = () => {
			if (typeof document !== 'undefined' && document.visibilityState === 'visible') refresh();
		};
		refresh();
		if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
		destroyRef.onDestroy(() => {
			if (midnight) clearTimeout(midnight);
			if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
		});

		afterRenderEffect(() => {
			const element = this.scroller()?.nativeElement;
			const todayLeft = this.todayLeft();
			const key = `${this.zoom()}|${dayNumberOf(this.timeline().firstDay)}`;
			if (!element || todayLeft === null || key === this.scrolledFor) return;
			this.scrolledFor = key;
			// Today a third of the way into the calendar's visible part.
			const visible = Math.max(0, (element.clientWidth || 0) - TIMELINE_TITLE_WIDTH);
			element.scrollLeft = Math.max(0, todayLeft - visible / 3);
		});
	}

	protected setZoom(zoom: TaskTimelineZoom): void {
		this.zoom.set(zoom);
	}

	protected open(task: ITask): void {
		if (task.id) this.opened.emit(task.id as ID);
	}

	protected showsTitleInBar(row: TimelineRow): boolean {
		return !row.bar.outside && row.width >= TITLE_IN_BAR_WIDTH;
	}

	protected trackRow(row: TimelineRow): string {
		return row.bar.taskId;
	}

	/**
	 * A date in the language chosen in the app, when Angular has that language's locale data; else in the app's locale
	 * (`LOCALE_ID`), as the list's dates are.
	 */
	private format(date: Date, format: string): string {
		const language = this.language();
		if (language && language !== this.locale) {
			try {
				return formatDate(date, format, language);
			} catch {
				// No locale data registered for the language: the app's locale below.
			}
		}
		return formatDate(date, format, this.locale);
	}

	/** A task's dates in words: the range (or its one date), then what is special about it. */
	private datesOf(bar: TaskTimelineBar, thisYear: number): string {
		const day = (value: number) => {
			const date = dateOfDayNumber(value);
			return this.format(date, date.getFullYear() === thisYear ? 'MMM d' : 'mediumDate');
		};
		const words: string[] = [];
		if (bar.taskStartDay !== null && bar.taskDueDay !== null && !bar.hasInvalidRange) {
			words.push(
				bar.taskStartDay === bar.taskDueDay
					? day(bar.taskDueDay)
					: this.translate.instant('TASK_VIEWS.TIMELINE.RANGE', {
							start: day(bar.taskStartDay),
							end: day(bar.taskDueDay)
						})
			);
		} else if (bar.hasInvalidRange && bar.taskStartDay !== null && bar.taskDueDay !== null) {
			words.push(
				this.translate.instant('TASK_VIEWS.TIMELINE.RANGE', {
					start: day(bar.taskStartDay),
					end: day(bar.taskDueDay)
				}),
				this.translate.instant('TASK_VIEWS.TIMELINE.INVALID_RANGE')
			);
		} else if (bar.isDueOnly && bar.taskDueDay !== null) {
			words.push(day(bar.taskDueDay), this.translate.instant('TASK_VIEWS.TIMELINE.DUE_ONLY'));
		} else if (bar.isStartOnly && bar.taskStartDay !== null) {
			words.push(day(bar.taskStartDay), this.translate.instant('TASK_VIEWS.TIMELINE.START_ONLY'));
		}
		if (bar.isOverdue) words.push(this.translate.instant('TASK_VIEWS.TIMELINE.OVERDUE'));
		if (bar.outside) {
			words.push(
				this.translate.instant(
					bar.outside === 'before' ? 'TASK_VIEWS.TIMELINE.BEFORE' : 'TASK_VIEWS.TIMELINE.AFTER'
				)
			);
		}
		return words.join(', ');
	}
}
