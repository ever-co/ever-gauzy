import { ITimeLog, TimeFormatEnum, TimeLogType } from '@gauzy/contracts';
import { buildManualTimeDay, dayRangeOf, percentOf } from './manual-time-day';

const log = (id: string, start: string, end: string, logType = TimeLogType.TRACKED): ITimeLog =>
	({
		id,
		logType,
		startedAt: new Date(start),
		stoppedAt: new Date(end),
		duration: (new Date(end).getTime() - new Date(start).getTime()) / 1000
	} as ITimeLog);

const ENTRY = log('entry', '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', TimeLogType.MANUAL);

describe('manual time day', () => {
	describe('dayRangeOf', () => {
		it('reads the day in the report zone, as UTC bounds, from a day early for logs crossing midnight', () => {
			// 10:00 UTC is 12:00 in Kigali (UTC+2): the day runs 22:00 UTC the day before to 21:59:59. The range
			// opens one more day early, since the API selects logs by when they started
			expect(dayRangeOf(ENTRY, 'Africa/Kigali')).toEqual({
				date: '2026-11-02',
				startDate: '2026-10-31 22:00:00',
				endDate: '2026-11-02 21:59:59'
			});
		});
	});

	describe('buildManualTimeDay', () => {
		it('splits the day into tracked time, other manual time and this entry', () => {
			const day = buildManualTimeDay(
				ENTRY,
				[
					log('t1', '2026-11-02T06:00:00Z', '2026-11-02T09:00:00Z'),
					log('m1', '2026-11-02T13:00:00Z', '2026-11-02T13:30:00Z', TimeLogType.MANUAL),
					ENTRY
				],
				'Etc/UTC'
			);

			expect(day.tracked).toBe(3 * 3600);
			expect(day.manual).toBe(1.5 * 3600);
			expect(day.current).toBe(3600);
			expect(day.total).toBe(4.5 * 3600);
			expect(day.segments.map((segment) => [segment.id, segment.kind])).toEqual([
				['t1', 'tracked'],
				['m1', 'manual'],
				// Drawn last, over anything it overlaps, and never twice
				['entry', 'current']
			]);
		});

		it('places each log on the 24-hour track', () => {
			const day = buildManualTimeDay(ENTRY, [], 'Etc/UTC', TimeFormatEnum.FORMAT_24_HOURS);
			const [segment] = day.segments;

			expect(segment.left).toBeCloseTo((10 / 24) * 100);
			expect(segment.width).toBeCloseTo((1 / 24) * 100);
			expect(segment.range).toBe('10:00 – 11:00');
		});

		it('clips a log that runs past midnight to the edge of the day', () => {
			const day = buildManualTimeDay(ENTRY, [log('late', '2026-11-02T23:00:00Z', '2026-11-03T01:00:00Z')], 'Etc/UTC');
			const late = day.segments.find((segment) => segment.id === 'late');

			expect(late.left + late.width).toBeCloseTo(100);
		});

		it('counts only the part of an overnight log inside the day, so the totals match the chart', () => {
			const day = buildManualTimeDay(
				ENTRY,
				[
					// 23:00 the evening before to 01:00: one hour belongs to this day
					log('early', '2026-11-01T23:00:00Z', '2026-11-02T01:00:00Z'),
					// 23:00 to 01:00 the next morning: one hour belongs to this day
					log('late', '2026-11-02T23:00:00Z', '2026-11-03T01:00:00Z'),
					// The day before, read only because the range opens early: not part of this day
					log('before', '2026-11-01T08:00:00Z', '2026-11-01T09:00:00Z')
				],
				'Etc/UTC'
			);

			expect(day.tracked).toBe(2 * 3600);
			expect(day.total).toBe(3 * 3600);
			expect(day.segments.map((segment) => segment.id)).toEqual(['early', 'late', 'entry']);
			expect(day.segments[0].left).toBe(0);
			expect(day.segments[0].width).toBeCloseTo((1 / 24) * 100);
		});

		it('follows the clock on a day the clocks change (25 hours in New York on 2026-11-01)', () => {
			// 23:00 EST on November 1 is 04:00 UTC on November 2, 24 elapsed hours after a 25-hour day began
			const entry = log('entry', '2026-11-02T04:00:00Z', '2026-11-02T04:30:00Z', TimeLogType.MANUAL);
			const day = buildManualTimeDay(entry, [], 'America/New_York', TimeFormatEnum.FORMAT_24_HOURS);

			expect(day.date).toBe('2026-11-01');
			expect(day.minutes).toBe(25 * 60);
			expect(day.segments).toHaveLength(1);
			expect(day.segments[0].range).toBe('23:00 – 23:30');
			expect(day.segments[0].left).toBeCloseTo((24 / 25) * 100);
			// Noon is 13 elapsed hours into that day
			expect(day.hourPositions[2]).toBeCloseTo((13 / 25) * 100);
			expect(day.hourPositions[4]).toBe(100);
		});

		it('still shows the entry when the rest of the day could not be read', () => {
			const day = buildManualTimeDay(ENTRY, null, 'Etc/UTC');

			expect(day.segments).toHaveLength(1);
			expect(day.total).toBe(3600);
		});
	});

	describe('percentOf', () => {
		it('is a whole percentage, and zero of nothing', () => {
			expect(percentOf(1, 3)).toBe(33);
			expect(percentOf(5, 0)).toBe(0);
		});
	});
});
