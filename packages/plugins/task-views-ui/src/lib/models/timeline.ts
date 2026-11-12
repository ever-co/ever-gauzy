/**
 * The timeline layout of a saved view: each task as a bar from its start date to its due date on a calendar of days,
 * the tasks without either date apart. Pure: the component draws what this answers. The same rules as the Ever Teams
 * timeline (`apps/web/core/lib/utils/team-tasks-timeline.ts`), so a view reads alike in both apps.
 *
 * Days are the reader's calendar days (a due date is a day, not a moment), counted from a fixed epoch so two dates
 * subtract to a whole number of days whatever the daylight-saving changes in between.
 */

/** How wide one day is drawn, per zoom. */
export type TaskTimelineZoom = 'week' | 'month';

export const TIMELINE_DAY_WIDTH: Record<TaskTimelineZoom, number> = { week: 36, month: 10 };

/** Days shown before the earliest bar and after the latest one (or today), so no bar touches an edge. */
export const TIMELINE_PADDING_DAYS: Record<TaskTimelineZoom, number> = { week: 3, month: 7 };

/** The longest calendar drawn: a task dated years away does not stretch the page past this. */
export const TIMELINE_MAX_DAYS = 3 * 366;

export interface TaskTimelineTask {
	id: string;
	startDate?: Date | string | null;
	dueDate?: Date | string | null;
	isDone: boolean;
}

export interface TaskTimelineBar {
	taskId: string;
	/** Day offsets from the first day drawn, both included (clamped to the days drawn). */
	startDay: number;
	endDay: number;
	/** The task's own dates as day numbers (never clamped): what its label says. */
	taskStartDay: number | null;
	taskDueDay: number | null;
	/**
	 * The bar lies wholly before or after the days drawn (the calendar was capped): no bar is drawn, only a marker at
	 * that edge, and the task keeps its row.
	 */
	outside: 'before' | 'after' | null;
	/** The task has a due date only: one day, at its due date. */
	isDueOnly: boolean;
	/** The task has a start date only: one day, at its start, with no end known. */
	isStartOnly: boolean;
	/** The due date came before the start date: drawn as one day at the start. */
	hasInvalidRange: boolean;
	/** Due before today and not done (by the task's own due date, also when it comes before the start). */
	isOverdue: boolean;
	/** The bar starts before the first day drawn, or ends after the last one (the calendar was capped). */
	isClippedStart: boolean;
	isClippedEnd: boolean;
}

export interface TaskTimeline {
	/** The first day drawn (local midnight). */
	firstDay: Date;
	/** How many days are drawn. */
	dayCount: number;
	/** Today's offset, or null when today is outside the days drawn. */
	todayDay: number | null;
	/** The tasks with a date, in the view's order. */
	bars: TaskTimelineBar[];
	/** The tasks with neither date, in the view's order. */
	unscheduledIds: string[];
}

export interface TaskTimelineTick {
	day: number;
	date: Date;
	/** The first day of a week (Monday) in the week zoom, of a month in the month zoom: labelled. */
	isMajor: boolean;
}

const DAY_MS = 86_400_000;

/** A calendar day of the reader, as a whole number of days. */
export function dayNumberOf(date: Date): number {
	return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** The local midnight of a day number. */
export function dateOfDayNumber(day: number): Date {
	const utc = new Date(day * DAY_MS);
	return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/**
 * A stored date as a day number. A bare `YYYY-MM-DD` and a date at midnight UTC name a day (the way a due date is
 * stored): that day, whatever the reader's zone. Any other moment is the reader's calendar day of that moment.
 */
export function dayOfStoredDate(value: Date | string | null | undefined): number | null {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	if (typeof value === 'string') {
		const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
		if (bare) {
			return Math.round(Date.UTC(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) / DAY_MS);
		}
	}
	const date = value instanceof Date ? value : new Date(value);
	const time = date.getTime();
	if (Number.isNaN(time)) {
		return null;
	}
	const isUtcMidnight =
		date.getUTCHours() === 0 &&
		date.getUTCMinutes() === 0 &&
		date.getUTCSeconds() === 0 &&
		date.getUTCMilliseconds() === 0;
	if (isUtcMidnight) {
		return Math.round(time / DAY_MS);
	}
	return dayNumberOf(date);
}

interface DatedTask {
	task: TaskTimelineTask;
	start: number;
	end: number;
	taskStart: number | null;
	taskDue: number | null;
	isDueOnly: boolean;
	isStartOnly: boolean;
	hasInvalidRange: boolean;
}

function datedTaskOf(task: TaskTimelineTask): DatedTask | null {
	const start = dayOfStoredDate(task.startDate);
	const due = dayOfStoredDate(task.dueDate);
	if (start === null && due === null) {
		return null;
	}
	const own = { taskStart: start, taskDue: due };
	if (start === null) {
		return {
			task,
			...own,
			start: due as number,
			end: due as number,
			isDueOnly: true,
			isStartOnly: false,
			hasInvalidRange: false
		};
	}
	if (due === null) {
		return { task, ...own, start, end: start, isDueOnly: false, isStartOnly: true, hasInvalidRange: false };
	}
	if (due < start) {
		return { task, ...own, start, end: start, isDueOnly: false, isStartOnly: false, hasInvalidRange: true };
	}
	return { task, ...own, start, end: due, isDueOnly: false, isStartOnly: false, hasInvalidRange: false };
}

/**
 * The timeline of the tasks, in their order. The days drawn run from the earliest start (or today) to the latest end
 * (or today), padded, at most {@link TIMELINE_MAX_DAYS} days: past that, the calendar stays around today and the bars
 * outside it are clipped.
 */
export function timelineOf(
	tasks: readonly TaskTimelineTask[],
	options: { today: Date; zoom: TaskTimelineZoom }
): TaskTimeline {
	const today = dayNumberOf(options.today);
	const padding = TIMELINE_PADDING_DAYS[options.zoom];
	const dated: DatedTask[] = [];
	const unscheduledIds: string[] = [];
	for (const task of tasks) {
		const datedTask = datedTaskOf(task);
		if (datedTask) {
			dated.push(datedTask);
		} else {
			unscheduledIds.push(task.id);
		}
	}

	let first = today;
	let last = today;
	for (const { start, end } of dated) {
		first = Math.min(first, start);
		last = Math.max(last, end);
	}
	first -= padding;
	last += padding;
	if (last - first + 1 > TIMELINE_MAX_DAYS) {
		// Keep today in view: as much before it as fits in a third of the calendar, the rest after it.
		const before = Math.min(today - first, Math.floor(TIMELINE_MAX_DAYS / 3));
		first = today - before;
		last = first + TIMELINE_MAX_DAYS - 1;
	}

	const bars = dated.map(({ task, start, end, taskStart, taskDue, isDueOnly, isStartOnly, hasInvalidRange }) => {
		let outside: TaskTimelineBar['outside'] = null;
		if (end < first) outside = 'before';
		else if (start > last) outside = 'after';
		const edge = outside === 'before' ? 0 : last - first;
		return {
			taskId: task.id,
			startDay: outside ? edge : Math.max(start, first) - first,
			endDay: outside ? edge : Math.min(end, last) - first,
			taskStartDay: taskStart,
			taskDueDay: taskDue,
			outside,
			isDueOnly,
			isStartOnly,
			hasInvalidRange,
			isOverdue: !task.isDone && taskDue !== null && taskDue < today,
			isClippedStart: !outside && start < first,
			isClippedEnd: !outside && end > last
		};
	});

	return {
		firstDay: dateOfDayNumber(first),
		dayCount: last - first + 1,
		todayDay: today >= first && today <= last ? today - first : null,
		// Every dated task keeps its row; one wholly outside the capped calendar is marked at that edge.
		bars,
		unscheduledIds
	};
}

/** The days of the calendar with the ones the header labels: Mondays in the week zoom, the 1st in the month zoom. */
export function ticksOf(timeline: TaskTimeline, zoom: TaskTimelineZoom): TaskTimelineTick[] {
	const first = dayNumberOf(timeline.firstDay);
	const ticks: TaskTimelineTick[] = [];
	for (let day = 0; day < timeline.dayCount; day += 1) {
		const date = dateOfDayNumber(first + day);
		const isMajor = zoom === 'week' ? date.getDay() === 1 : date.getDate() === 1;
		ticks.push({ day, date, isMajor });
	}
	return ticks;
}

/** Whether a task is done: its status says so, or (a status without the flag) is named done, completed or cancelled. */
export function isDoneTask(task: { status?: unknown; taskStatus?: { isDone?: boolean | null } | null }): boolean {
	if (task.taskStatus?.isDone) return true;
	return ['done', 'completed', 'cancelled'].includes(String(task.status ?? '').toLowerCase());
}
