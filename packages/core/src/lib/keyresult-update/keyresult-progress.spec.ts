import { KeyResultTypeEnum, KpiOperatorEnum } from '@gauzy/contracts';
import { goalProgress, keyResultProgress } from './keyresult-progress';

/**
 * Owner decision 2(a) (2026-10-23): the server applies a filed progress update to its key result and goal, so the
 * computation the goals page ran in the browser (`KeyResultUpdateComponent.updateKeyResult`,
 * `KeyResultDetailsComponent.keyResultUpdate`, `calculateGoalProgress`) runs here once, with the divisions by zero
 * the page saved as `NaN` or `Infinity` answered instead.
 */
describe('key result progress', () => {
	describe.each([KeyResultTypeEnum.NUMERICAL, KeyResultTypeEnum.CURRENCY])('a %s key result', (type) => {
		it('is the share of the distance from the initial value to the target the value has come', () => {
			expect(keyResultProgress({ type, initialValue: 0, targetValue: 200 }, 50)).toEqual({
				update: 50,
				progress: 25
			});
			expect(keyResultProgress({ type, initialValue: 10, targetValue: 20 }, 20)).toEqual({
				update: 20,
				progress: 100
			});
		});

		it('counts down the same way when the target is below the initial value', () => {
			expect(keyResultProgress({ type, initialValue: 100, targetValue: 0 }, 25)).toEqual({
				update: 25,
				progress: 75
			});
		});

		it('rounds, as the page did', () => {
			expect(keyResultProgress({ type, initialValue: 0, targetValue: 3 }, 1).progress).toBe(33);
		});

		it('is done or not when the target is the initial value, instead of dividing by zero', () => {
			const flat = { type, initialValue: 5, targetValue: 5 };

			expect(keyResultProgress(flat, 5)).toEqual({ update: 5, progress: 100 });
			expect(keyResultProgress(flat, 4)).toEqual({ update: 4, progress: 0 });
		});

		it('reads a missing initial value as 0', () => {
			expect(keyResultProgress({ type, initialValue: null, targetValue: 10 }, 5).progress).toBe(50);
		});
	});

	describe.each([KeyResultTypeEnum.TRUE_OR_FALSE, KeyResultTypeEnum.TASK])('a %s key result', (type) => {
		it('is done (1, 100%) or not (0, 0%)', () => {
			expect(keyResultProgress({ type }, 1)).toEqual({ update: 1, progress: 100 });
			expect(keyResultProgress({ type }, 0)).toEqual({ update: 0, progress: 0 });
			expect(keyResultProgress({ type }, 7)).toEqual({ update: 1, progress: 100 });
		});
	});

	describe('a KPI key result', () => {
		it('is reached at or above the target unless its KPI says otherwise', () => {
			expect(keyResultProgress({ type: KeyResultTypeEnum.KPI, targetValue: 10 }, 10).progress).toBe(100);
			expect(keyResultProgress({ type: KeyResultTypeEnum.KPI, targetValue: 10 }, 9).progress).toBe(0);

			const kpi = { operator: KpiOperatorEnum.GREATER_THAN_EQUAL_TO };
			expect(keyResultProgress({ type: KeyResultTypeEnum.KPI, targetValue: 10, kpi }, 11)).toEqual({
				update: 11,
				progress: 100
			});
		});

		it('is reached at or below the target when its KPI counts down', () => {
			const kpi = { operator: KpiOperatorEnum.LESSER_THAN_EQUAL_TO };

			expect(keyResultProgress({ type: KeyResultTypeEnum.KPI, targetValue: 10, kpi }, 10).progress).toBe(100);
			expect(keyResultProgress({ type: KeyResultTypeEnum.KPI, targetValue: 10, kpi }, 11).progress).toBe(0);
		});
	});
});

describe('goal progress', () => {
	it('is the average of its key results, weighted', () => {
		expect(
			goalProgress([
				{ progress: 50, weight: '1' },
				{ progress: 30, weight: '2' }
			])
		).toBe(37);
		expect(
			goalProgress([
				{ progress: 100, weight: '4' },
				{ progress: 0, weight: '1' }
			])
		).toBe(80);
	});

	it('leaves a key result without a weight out, as the page did', () => {
		expect(
			goalProgress([
				{ progress: 100, weight: null },
				{ progress: 20, weight: '1' }
			])
		).toBe(20);
	});

	it('is the plain average when no key result has a weight, instead of dividing by zero', () => {
		expect(
			goalProgress([
				{ progress: 100, weight: null },
				{ progress: 20, weight: undefined }
			])
		).toBe(60);
	});

	it('is 0 for a goal with no key results', () => {
		expect(goalProgress([])).toBe(0);
	});
});
