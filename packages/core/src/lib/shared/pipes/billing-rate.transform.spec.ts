/**
 * Load the entity graph first, as the application does, before importing entities.
 */
import '../../core/entities/internal';

import { getMetadataArgsStorage } from 'typeorm';
import { Candidate } from '../../candidate/candidate.entity';
import { Employee } from '../../employee/employee.entity';
import { billingRateColumn, toBillingRate } from './billing-rate.transform';
import { ColumnNumericTransformerPipe } from './column-numeric-transformer.pipe';

const columnOptions = (target: Function, propertyName: string) =>
	getMetadataArgsStorage().columns.find((column) => column.target === target && column.propertyName === propertyName)
		?.options;

/**
 * The migrations (1790000014000 for employee, 1790000016000 for candidate) create `numeric(14,2)`;
 * the entities must declare the same, with the scale-2 transformer, or Postgres/MySQL reads come back
 * as strings and `migration:generate` shows drift.
 */
describe.each([
	['Employee', Employee],
	['Candidate', Candidate]
])('%s billing rate columns', (_name, entity) => {
	it.each(['billRateValue', 'minimumBillingRate'])('%s is numeric(14,2) with the scale-2 transformer', (property) => {
		const options = columnOptions(entity, property);

		expect(options).toMatchObject({ type: 'numeric', precision: 14, scale: 2, nullable: true });
		expect(options?.transformer).toBeInstanceOf(ColumnNumericTransformerPipe);
		expect((options?.transformer as ColumnNumericTransformerPipe).to('10.499')).toBe(10.5);
	});

	it('leaves reWeeklyLimit (hours) as a plain integer column', () => {
		const options = columnOptions(entity, 'reWeeklyLimit');

		// No explicit type: TypeORM infers integer from the `number` design type.
		expect(options?.type).toBe(Number);
		expect(options?.scale).toBeUndefined();
	});
});

describe('billingRateColumn / toBillingRate', () => {
	it('gives each column its own transformer instance', () => {
		expect(billingRateColumn().transformer).not.toBe(billingRateColumn().transformer);
	});

	it.each([
		['10.49', 10.49],
		[1.005, 1.01],
		['10,50', 10],
		['', 0],
		[null, 0],
		[undefined, 0]
	])('parses %p to %p', (value, expected) => {
		expect(toBillingRate({ value } as never)).toBe(expected);
	});

	it.each(['abc', true, {}, 'Infinity'])('leaves %p as NaN so @IsNumber rejects it', (value) => {
		expect(toBillingRate({ value } as never)).toBeNaN();
	});
});
