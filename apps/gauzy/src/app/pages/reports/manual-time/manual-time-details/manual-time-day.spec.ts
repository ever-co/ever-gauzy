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
		it('reads the whole day in the report zone, as UTC bounds', () => {
			// 10:00 UTC is 12:00 in Kigali (UTC+2): the day runs 22:00 UTC the day before to 21:59:59
			expect(dayRangeOf(ENTRY, 'Africa/Kigali')).toEqual({
				date: '2026-11-02',
				startDate: '2026-11-01 22:00:00',
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
