// `@gauzy/core` is doubled for the reason the package's other migration suites state: the migration set
// imports a helper from its barrel, which boots the whole application graph. The tick under test calls
// nothing in it.
jest.mock('@gauzy/core', () => ({}));

import { DatabaseTypeEnum } from '@gauzy/config';
import { AddOrderTransactionPaymentFactUniqueIndex1791000000793 } from './migrations/1791000000793-AddOrderTransactionPaymentFactUniqueIndex';
import { AddOrderCartUniqueIndex1791000000782, ALL_ORDER_MIGRATIONS } from './order-migrations';

/**
 * Q7-W1b — one payment-side money fact is one row of an order's money ledger.
 *
 * The writer reads before it inserts, so two reports of one capture racing each other could both insert, and
 * the second `CAPTURE` row would count the money twice (CodeRabbit on #10890). This tick is the database's
 * statement of the rule, scoped to the rows the payment domain reports.
 */
function recordingRunner(state: { type: DatabaseTypeEnum; index?: boolean; column?: boolean; duplicates?: string[] }) {
	const statements: string[] = [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => table === 'order_transaction',
		hasColumn: async (table: string, column: string) =>
			table === 'order_transaction' && column === 'paymentFactKey' && state.column === true,
		query: async (sql: string) => {
			statements.push(sql);

			if (/FROM (pg_indexes|sqlite_master|information_schema\.statistics)/.test(sql)) {
				return state.index ? [{ present: 1 }] : [];
			}

			if (/GROUP BY/.test(sql)) {
				return (state.duplicates ?? []).map((orderId) => ({ orderId }));
			}

			return [];
		}
	};
}

/** The statements that change the schema, with the probes left out. */
const ddlOf = (runner: { statements: string[] }): string[] =>
	runner.statements.filter((statement) => !statement.startsWith('SELECT '));

describe('AddOrderTransactionPaymentFactUniqueIndex1791000000793 (Q7-W1b)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('states the rule in each dialect’s own form, over the payment facts only', async () => {
		const partial =
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_transaction_payment_fact" ON "order_transaction" ` +
			`("orderId", "type", "referenceType", "referenceId") WHERE "referenceType" IN ('PAYMENT', 'PAYMENT_CAPTURE', 'REFUND') ` +
			`AND "referenceId" IS NOT NULL AND "deletedAt" IS NULL`;
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [partial],
			[DatabaseTypeEnum.sqlite]: [partial],
			[DatabaseTypeEnum.mysql]: [
				"ALTER TABLE `order_transaction` ADD COLUMN `paymentFactKey` varchar(191) GENERATED ALWAYS AS (IF(`referenceType` IN ('PAYMENT', 'PAYMENT_CAPTURE', 'REFUND') AND `referenceId` IS NOT NULL AND `deletedAt` IS NULL, CONCAT(`orderId`, ':', `type`, ':', `referenceType`, ':', `referenceId`), NULL)) VIRTUAL",
				'CREATE UNIQUE INDEX `UQ_order_transaction_payment_fact` ON `order_transaction` (`paymentFactKey`)'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().up(runner as never);

			expect(ddlOf(runner)).toEqual(statements);
		}
	});

	it('reuses a MySQL generated column an interrupted run left behind', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.mysql, column: true });

		await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().up(runner as never);

		expect(ddlOf(runner)).toEqual([
			'CREATE UNIQUE INDEX `UQ_order_transaction_payment_fact` ON `order_transaction` (`paymentFactKey`)'
		]);
	});

	it('issues no DDL where the index is there or duplicates exist — and never a DELETE or UPDATE', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const present = recordingRunner({ type, index: true });

			await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().up(present as never);
			expect(ddlOf(present)).toEqual([]);

			const duplicated = recordingRunner({ type, duplicates: ['order-1'] });

			await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().up(duplicated as never);
			expect(ddlOf(duplicated)).toEqual([]);
			expect(duplicated.statements.join('\n')).not.toMatch(/DELETE|UPDATE/);
		}
	});

	it('drops exactly what it creates, only where it is present', async () => {
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: ['DROP INDEX IF EXISTS "UQ_order_transaction_payment_fact"'],
			[DatabaseTypeEnum.sqlite]: ['DROP INDEX IF EXISTS "UQ_order_transaction_payment_fact"'],
			[DatabaseTypeEnum.mysql]: [
				'DROP INDEX `UQ_order_transaction_payment_fact` ON `order_transaction`',
				'ALTER TABLE `order_transaction` DROP COLUMN `paymentFactKey`'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const present = recordingRunner({ type: type as DatabaseTypeEnum, index: true, column: true });

			await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().down(present as never);
			expect(ddlOf(present)).toEqual(statements);

			const absent = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderTransactionPaymentFactUniqueIndex1791000000793().down(absent as never);
			expect(ddlOf(absent)).toEqual([]);
		}
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddOrderTransactionPaymentFactUniqueIndex1791000000793().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('runs after the cart unique-index tick, last of the set', () => {
		expect(ALL_ORDER_MIGRATIONS[ALL_ORDER_MIGRATIONS.length - 1]).toBe(
			AddOrderTransactionPaymentFactUniqueIndex1791000000793
		);
		expect(ALL_ORDER_MIGRATIONS.indexOf(AddOrderCartUniqueIndex1791000000782)).toBeLessThan(
			ALL_ORDER_MIGRATIONS.indexOf(AddOrderTransactionPaymentFactUniqueIndex1791000000793)
		);
	});
});
