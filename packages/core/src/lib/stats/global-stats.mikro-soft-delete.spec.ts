import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InvoiceService } from '../invoice/invoice.service';
import { PaymentService } from '../payment/payment.service';

type Row = Record<string, unknown>;

/**
 * Minimal knex stand-in: records the `where` / `whereNull` predicates and computes `count` / `sum`
 * over an in-memory table, so the tests check the returned totals rather than just the calls.
 */
function createKnex(tables: Record<string, Row[]>) {
	const calls: { table?: string; where: [string, unknown][]; whereNull: string[] } = { where: [], whereNull: [] };
	const knex = jest.fn((table: string) => {
		calls.table = table;
		const filters: ((row: Row) => boolean)[] = [];
		let sumColumn: string;
		const builder = {
			where(column: string, value: unknown) {
				calls.where.push([column, value]);
				filters.push((row) => row[column] === value);
				return builder;
			},
			whereNull(column: string) {
				calls.whereNull.push(column);
				filters.push((row) => row[column] === null || row[column] === undefined);
				return builder;
			},
			count() {
				return builder;
			},
			sum(expression: string) {
				[sumColumn] = expression.split(' ');
				return builder;
			},
			async first() {
				const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
				const amount = rows.reduce((total, row) => total + Number(row[sumColumn]), 0);
				// Drivers return aggregates as strings
				return { count: String(rows.length), amount: String(amount) };
			}
		};
		return builder;
	});
	return { knex, calls };
}

/**
 * The public `/stats/global` totals use raw knex under MikroORM, which bypasses the soft-delete filter
 * TypeORM's query builder applies, so deleted invoices / payments must be excluded explicitly.
 */
describe('Global invoice / payment stats exclude soft-deleted rows (MikroORM)', () => {
	const deletedAt = new Date('2026-01-01');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const typeOrmRepository = { metadata: { tableName: 'stub' } } as any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mikroOrmRepository = (knex: jest.Mock) => ({ getEntityManager: () => ({ getKnex: () => knex }) }) as any;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('invoice stats count active invoices only (no deleted rows, no estimates)', async () => {
		const { knex, calls } = createKnex({
			invoice: [
				{ isEstimate: false, deletedAt: null, totalValue: 10 },
				{ isEstimate: false, deletedAt: null, totalValue: 20.5 },
				{ isEstimate: false, deletedAt, totalValue: 1000 },
				{ isEstimate: true, deletedAt: null, totalValue: 500 }
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const stub = {} as any;
		const service = new InvoiceService(typeOrmRepository, mikroOrmRepository(knex), stub, stub, stub, stub, stub);

		await expect(service.getInvoiceStats()).resolves.toEqual({ count: 2, amount: 30.5 });
		expect(calls.table).toBe('invoice');
		expect(calls.where).toContainEqual(['isEstimate', false]);
		expect(calls.whereNull).toContain('deletedAt');
	});

	it('payment stats count active payments only (no deleted rows)', async () => {
		const { knex, calls } = createKnex({
			payment: [
				{ deletedAt: null, amount: 7 },
				{ deletedAt: null, amount: 3 },
				{ deletedAt, amount: 90 }
			]
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new PaymentService(typeOrmRepository, mikroOrmRepository(knex), {} as any);

		await expect(service.getPaymentStats()).resolves.toEqual({ count: 2, amount: 10 });
		expect(calls.table).toBe('payment');
		expect(calls.whereNull).toContain('deletedAt');
	});
});
