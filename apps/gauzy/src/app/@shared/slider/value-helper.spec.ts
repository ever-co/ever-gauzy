import { ValueHelper } from './value-helper';
import { CustomStepDefinition } from './options';

const precision: number = 0.0001;

describe('ValueHelper', () => {
	describe('linearValueToPosition', () => {
		it('converts using linear interpolation', () => {
			const number: number = 55;
			const minValue: number = 0;
			const maxValue: number = 100;
			expect(
				ValueHelper.linearValueToPosition(number, minValue, maxValue)
			).toBeCloseTo(0.55, precision);
		});
	});

	describe('linearPositionToValue', () => {
		it('converts using linear interpolation', () => {
			const percent: number = 0.55;
			const minValue: number = 0;
			const maxValue: number = 100;
			expect(
				ValueHelper.linearPositionToValue(percent, minValue, maxValue)
			).toBeCloseTo(55, precision);
		});
	});

	describe('logValueToPosition', () => {
		it('converts using log scale', () => {
			const number: number = 1e2;
			const minValue: number = 1;
			const maxValue: number = 1e10;
			expect(
				ValueHelper.logValueToPosition(number, minValue, maxValue)
			).toBeCloseTo(0.2, precision);
		});
	});

	describe('logPositionToValue', () => {
		it('converts using log scale', () => {
			const percent: number = 0.2;
			const minValue: number = 1;
			const maxValue: number = 1e10;
			expect(
				ValueHelper.logPositionToValue(percent, minValue, maxValue)
			).toBeCloseTo(1e2, precision);
		});
	});

	describe('findStepIndex', () => {
		it('finds the first equal index if value is equal', () => {
			const stepArray: CustomStepDefinition[] = [
				{
					value: 1
				},
				{
					value: 2
				},
				{
					value: 3
				}
			];

			expect(ValueHelper.findStepIndex(1, stepArray)).toEqual(0);
			expect(ValueHelper.findStepIndex(2, stepArray)).toEqual(1);
			expect(ValueHelper.findStepIndex(3, stepArray)).toEqual(2);
		});

		it('finds the closest index if value is not equal', () => {
			const stepArray: CustomStepDefinition[] = [
				{
					value: 10
				},
				{
					value: 20
				},
				{
					value: 30
				}
			];

			expect(ValueHelper.findStepIndex(9, stepArray)).toEqual(0);
			expect(ValueHelper.findStepIndex(11, stepArray)).toEqual(0);
			expect(ValueHelper.findStepIndex(15, stepArray)).toEqual(0);

			expect(ValueHelper.findStepIndex(16, stepArray)).toEqual(1);
			expect(ValueHelper.findStepIndex(19, stepArray)).toEqual(1);
			expect(ValueHelper.findStepIndex(21, stepArray)).toEqual(1);
			expect(ValueHelper.findStepIndex(25, stepArray)).toEqual(1);

			expect(ValueHelper.findStepIndex(26, stepArray)).toEqual(2);
			expect(ValueHelper.findStepIndex(29, stepArray)).toEqual(2);
			expect(ValueHelper.findStepIndex(31, stepArray)).toEqual(2);
		});
	});
});
