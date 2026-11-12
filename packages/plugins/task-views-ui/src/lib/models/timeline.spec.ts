import {
	TIMELINE_MAX_DAYS,
	TIMELINE_PADDING_DAYS,
	dayNumberOf,
	dayOfStoredDate,
	isDoneTask,
	ticksOf,
	timelineOf,
	type TaskTimelineTask
} from './timeline';

const TODAY = new Date(2026, 10, 12, 15, 30); // 12 Nov 2026, afternoon, local
const task = (id: string, overrides: Partial<TaskTimelineTask> = {}): TaskTimelineTask => ({
	id,
	startDate: null,
	dueDate: null,
	isDone: false,
	...overrides
});

describe('the days of stored dates', () => {
	it('reads a bare date and midnight UTC as that day, in any zone of the reader', () => {
		const zone = process.env['TZ'];
		try {
			for (const readerZone of ['America/Los_Angeles', 'Asia/Tokyo', 'Europe/Paris', 'UTC']) {
				process.env['TZ'] = readerZone;
				const nov20 = dayNumberOf(new Date(2026, 10, 20));
				expect(`${readerZone} ${dayOfStoredDate('2026-11-20')}`).toBe(`${readerZone} ${nov20}`);
				expect(`${readerZone} ${dayOfStoredDate('2026-11-20T00:00:00.000Z')}`).toBe(`${readerZone} ${nov20}`);
				expect(`${readerZone} ${dayOfStoredDate(new Date('2026-11-20T00:00:00Z'))}`).toBe(
					`${readerZone} ${nov20}`
				);
			}
		} finally {
			if (zone === undefined) delete process.env['TZ'];
			else process.env['TZ'] = zone;
		}
	});

	it('reads any other moment as the reader’s day of that moment, and nothing as no day', () => {
		expect(dayOfStoredDate(new Date(2026, 10, 20, 9, 0))).toBe(dayNumberOf(new Date(2026, 10, 20)));
		expect(dayOfStoredDate(null)).toBeNull();
		expect(dayOfStoredDate(undefined)).toBeNull();
		expect(dayOfStoredDate('')).toBeNull();
		expect(dayOfStoredDate('not a date')).toBeNull();
	});

	it('counts whole days across a daylight-saving change', () => {
		const zone = process.env['TZ'];
		try {
			process.env['TZ'] = 'Europe/Paris';
			// 25 Oct 2026 is 25 hours long in Paris.
			expect(dayNumberOf(new Date(2026, 9, 26)) - dayNumberOf(new Date(2026, 9, 25))).toBe(1);
		} finally {
			if (zone === undefined) delete process.env['TZ'];
			else process.env['TZ'] = zone;
		}
	});
});

describe('the timeline of a view', () => {
	const today = dayNumberOf(TODAY);

	it('draws a task from its start to its due date, and sets the undated ones apart in their order', () => {
		const timeline = timelineOf(
			[
				task('a', { startDate: '2026-11-10', dueDate: '2026-11-14' }),
				task('b'),
				task('c', { dueDate: '2026-11-20' }),
				task('d')
			],
			{ today: TODAY, zoom: 'week' }
		);
		const first = dayNumberOf(timeline.firstDay);
		const padding = TIMELINE_PADDING_DAYS.week;
		expect(first).toBe(dayNumberOf(new Date(2026, 10, 10)) - padding);
		expect(timeline.dayCount).toBe(dayNumberOf(new Date(2026, 10, 20)) + padding - first + 1);
		expect(timeline.todayDay).toBe(today - first);
		expect(timeline.unscheduledIds).toEqual(['b', 'd']);
		expect(timeline.bars.map((bar) => bar.taskId)).toEqual(['a', 'c']);
		expect(timeline.bars[0]).toMatchObject({
			startDay: padding,
			endDay: padding + 4,
			isDueOnly: false,
			isOverdue: false
		});
		expect(timeline.bars[1]).toMatchObject({ isDueOnly: true });
		expect(timeline.bars[1].endDay - timeline.bars[1].startDay).toBe(0);
	});

	it('marks an open task due before today as overdue, never a done one, nor one with a start date only', () => {
		const timeline = timelineOf(
			[
				task('late', { dueDate: '2026-11-01' }),
				task('done', { dueDate: '2026-11-01', isDone: true }),
				task('started', { startDate: '2026-11-01' }),
				task('today', { dueDate: '2026-11-12' })
			],
			{ today: TODAY, zoom: 'week' }
		);
		expect(timeline.bars.map((bar) => [bar.taskId, bar.isOverdue])).toEqual([
			['late', true],
			['done', false],
			['started', false],
			['today', false]
		]);
		expect(timeline.bars[2]).toMatchObject({ isStartOnly: true });
	});

	it('draws a due date before the start as one day at the start, and says so; overdue by its own due date', () => {
		const [bar] = timelineOf([task('x', { startDate: '2026-11-15', dueDate: '2026-11-10' })], {
			today: TODAY,
			zoom: 'week'
		}).bars;
		expect(bar).toMatchObject({ hasInvalidRange: true, isOverdue: true });
		expect(bar.endDay).toBe(bar.startDay);
		expect(bar.taskDueDay).toBe(dayNumberOf(new Date(2026, 10, 10)));
		expect(bar.taskStartDay).toBe(dayNumberOf(new Date(2026, 10, 15)));
	});

	it('shows today alone, padded, when no task has a date', () => {
		const timeline = timelineOf([task('a')], { today: TODAY, zoom: 'month' });
		const padding = TIMELINE_PADDING_DAYS.month;
		expect(timeline.dayCount).toBe(2 * padding + 1);
		expect(timeline.todayDay).toBe(padding);
		expect(timeline.bars).toEqual([]);
	});

	it('caps the calendar around today and clips the bars past it, keeping their own dates', () => {
		const timeline = timelineOf(
			[task('far', { startDate: '2020-01-01', dueDate: '2032-01-01' }), task('near', { dueDate: '2026-11-13' })],
			{ today: TODAY, zoom: 'month' }
		);
		expect(timeline.dayCount).toBe(TIMELINE_MAX_DAYS);
		expect(timeline.todayDay).not.toBeNull();
		const far = timeline.bars.find((bar) => bar.taskId === 'far');
		expect(far).toMatchObject({
			startDay: 0,
			endDay: TIMELINE_MAX_DAYS - 1,
			isClippedStart: true,
			isClippedEnd: true,
			outside: null
		});
		expect(far?.taskStartDay).toBe(dayNumberOf(new Date(2020, 0, 1)));
		expect(timeline.bars.find((bar) => bar.taskId === 'near')).toMatchObject({
			isClippedStart: false,
			isClippedEnd: false
		});
	});

	it('keeps the row of a task wholly outside the capped calendar, marked at that edge', () => {
		const timeline = timelineOf(
			[
				task('long', { startDate: '2026-01-01', dueDate: '2029-12-31' }),
				task('old', { dueDate: '2020-01-01' }),
				task('later', { startDate: '2031-06-01' })
			],
			{ today: TODAY, zoom: 'month' }
		);
		expect(timeline.dayCount).toBe(TIMELINE_MAX_DAYS);
		expect(timeline.bars.map((bar) => [bar.taskId, bar.outside])).toEqual([
			['long', null],
			['old', 'before'],
			['later', 'after']
		]);
		const old = timeline.bars[1];
		expect(old).toMatchObject({
			startDay: 0,
			endDay: 0,
			isOverdue: true,
			taskDueDay: dayNumberOf(new Date(2020, 0, 1))
		});
		expect(timeline.bars[2]).toMatchObject({ startDay: TIMELINE_MAX_DAYS - 1, endDay: TIMELINE_MAX_DAYS - 1 });
	});
});

describe('the ticks of the header', () => {
	it('labels Mondays in the week zoom and the first of the month in the month zoom', () => {
		const timeline = timelineOf([task('a', { startDate: '2026-10-28', dueDate: '2026-11-05' })], {
			today: TODAY,
			zoom: 'week'
		});
		const week = ticksOf(timeline, 'week');
		expect(week).toHaveLength(timeline.dayCount);
		expect(week.filter((tick) => tick.isMajor).every((tick) => tick.date.getDay() === 1)).toBe(true);
		const month = ticksOf(timeline, 'month');
		expect(month.filter((tick) => tick.isMajor).map((tick) => tick.date.getDate())).toEqual([1]);
	});
});

describe('a done task', () => {
	it('is done by its status flag, or by a status named done, completed or cancelled', () => {
		expect(isDoneTask({ taskStatus: { isDone: true }, status: 'open' })).toBe(true);
		expect(isDoneTask({ status: 'Completed' })).toBe(true);
		expect(isDoneTask({ status: 'cancelled' })).toBe(true);
		expect(isDoneTask({ status: 'in-progress', taskStatus: { isDone: false } })).toBe(false);
		expect(isDoneTask({})).toBe(false);
	});
});
