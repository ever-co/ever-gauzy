import * as moment from 'moment';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import {
	bookedDayBars,
	bookedRanges,
	dayNumber,
	daysCovered,
	IEquipmentChartSharing,
	requestBars,
	yearUse
} from './equipment-view-charts';

const { APPROVED, REFUSED, REQUESTED } = RequestApprovalStatusTypesEnum;

function sharing(status: number, start: string, end: string, asked = start): IEquipmentChartSharing {
	return {
		status,
		shareRequestDay: new Date(`${asked}T12:00:00`),
		shareStartDay: new Date(`${start}T12:00:00`),
		shareEndDay: new Date(`${end}T12:00:00`)
	};
}

describe('equipment view charts', () => {
	const today = moment('2026-03-15T10:00:00');

	const day = (date: string) => dayNumber(`${date}T12:00:00`);

	describe('dayNumber', () => {
		it('numbers consecutive calendar days one apart, whatever the time of day', () => {
			expect(dayNumber('2026-03-02T00:30:00') - dayNumber('2026-03-01T23:30:00')).toBe(1);
			expect(day('2026-03-01') - day('2026-02-28')).toBe(1);
		});
	});

	describe('bookedRanges', () => {
		it('keeps approved sharings only, both ends included, and merges overlapping or touching runs', () => {
			const ranges = bookedRanges(
				[
					sharing(APPROVED, '2026-03-06', '2026-03-07'), // touches the run before it: merged
					sharing(APPROVED, '2026-03-01', '2026-03-03'),
					sharing(APPROVED, '2026-03-03', '2026-03-05'), // overlaps on the 3rd: counted once
					sharing(APPROVED, '2026-03-20', '2026-03-20'),
					sharing(REFUSED, '2026-03-10', '2026-03-12'),
					sharing(REQUESTED, '2026-03-10', '2026-03-12')
				],
				day('2026-01-01'),
				day('2026-12-31')
			);

			expect(ranges).toEqual([
				[day('2026-03-01'), day('2026-03-07')],
				[day('2026-03-20'), day('2026-03-20')]
			]);
			expect(daysCovered(ranges, day('2026-01-01'), day('2026-12-31'))).toBe(8);
		});

		it('keeps to the span it is given', () => {
			const ranges = bookedRanges([sharing(APPROVED, '2026-02-27', '2026-03-02')], day('2026-03-01'), day('2026-03-01'));

			expect(ranges).toEqual([[day('2026-03-01'), day('2026-03-01')]]);
		});

		it('works out a sharing years long without walking its days', () => {
			const ranges = bookedRanges([sharing(APPROVED, '2000-01-01', '2099-12-31')], day('2026-01-01'), day('2026-12-31'));

			expect(daysCovered(ranges, day('2026-01-01'), day('2026-12-31'))).toBe(365);
		});
	});

	describe('bookedDayBars', () => {
		it('splits a sharing across the months it spans and highlights the current month', () => {
			const bars = bookedDayBars([sharing(APPROVED, '2026-02-27', '2026-03-02')], 3, 'en', today);

			expect(bars.map((bar) => [bar.label, bar.value, bar.highlight])).toEqual([
				['Jan', 0, false],
				['Feb', 2, false],
				['Mar', 2, true]
			]);
		});
	});

	describe('requestBars', () => {
		it('counts every request in the month it was made, whatever became of it', () => {
			const bars = requestBars(
				[
					sharing(APPROVED, '2026-03-20', '2026-03-21', '2026-02-10'),
					sharing(REFUSED, '2026-03-01', '2026-03-02', '2026-03-01'),
					sharing(REQUESTED, '2026-04-01', '2026-04-02', '2026-03-12')
				],
				2,
				'en',
				today
			);

			expect(bars.map((bar) => [bar.label, bar.value])).toEqual([
				['Feb', 1],
				['Mar', 2]
			]);
		});
	});

	describe('yearUse', () => {
		it('sets the days booked so far this year against the days the year has had', () => {
			const use = yearUse(
				[
					sharing(APPROVED, '2025-12-30', '2026-01-02'), // 2 days fall in this year
					sharing(APPROVED, '2026-03-14', '2026-03-20') // booked past today: 2 days so far
				],
				today
			);

			// 1 January to 15 March: 31 + 28 + 15 days.
			expect(use).toEqual({ amount: 4, rest: 70, total: 74, percent: 5.4 });
		});
	});
});
