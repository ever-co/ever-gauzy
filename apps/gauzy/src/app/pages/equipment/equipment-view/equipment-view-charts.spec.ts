import * as moment from 'moment';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { bookedDayBars, bookedDays, IEquipmentChartSharing, requestBars, yearUse } from './equipment-view-charts';

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

	describe('bookedDays', () => {
		it('counts approved sharings only, both ends included, and an overlapped day once', () => {
			const days = bookedDays(
				[
					sharing(APPROVED, '2026-03-01', '2026-03-03'),
					sharing(APPROVED, '2026-03-03', '2026-03-04'),
					sharing(REFUSED, '2026-03-10', '2026-03-12'),
					sharing(REQUESTED, '2026-03-10', '2026-03-12')
				],
				moment('2026-01-01'),
				moment('2026-12-31')
			);

			expect([...days].sort()).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
		});

		it('keeps to the range it is given', () => {
			const days = bookedDays([sharing(APPROVED, '2026-02-27', '2026-03-02')], moment('2026-03-01'), moment('2026-03-01'));

			expect([...days]).toEqual(['2026-03-01']);
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
