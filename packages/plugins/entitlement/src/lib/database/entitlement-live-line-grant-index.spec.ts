// The repository is only the provider's way to TypeORM's connection; its entity graph has no part in these cases.
jest.mock('../entitlement/repository/type-orm-entitlement.repository', () => ({
	TypeOrmEntitlementRepository: class {}
}));

import { Logger } from '@nestjs/common';
import { DatabaseTypeEnum } from '@gauzy/config';
import {
	AddEntitlementLiveLineGrantUniqueIndex1791000003580,
	AddEntitlementVersionColumn1791000000580,
	ENTITLEMENT_MIGRATIONS
} from './migrations';
import { EntitlementLiveLineGrantIndex } from './entitlement-live-line-grant-index';

/**
 * #11023 — one order line grants at most one live right of a kind.
 *
 * The grant reads before it inserts, so two deliveries of one `order.placed` racing each other could both
 * insert, and the customer would hold two licences for one purchase. This tick is the database's statement of
 * the rule; the grant answers its refusal by replaying the winner's right.
 */
function recordingRunner(state: {
	type: DatabaseTypeEnum;
	index?: boolean;
	column?: boolean;
	table?: boolean;
	duplicates?: string[];
}) {
	const statements: string[] = [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => table === 'entitlement' && state.table !== false,
		hasColumn: async (table: string, column: string) =>
			table === 'entitlement' && column === 'liveLineGrantKey' && state.column === true,
		query: async (sql: string) => {
			statements.push(sql);

			if (/FROM (pg_indexes|sqlite_master|information_schema\.statistics)/.test(sql)) {
				return state.index ? [{ present: 1 }] : [];
			}

			if (/GROUP BY/.test(sql)) {
				return (state.duplicates ?? []).map((orderLineId) => ({ orderLineId }));
			}

			return [];
		}
	};
}

/** The statements that change the schema, with the probes left out. */
const ddlOf = (runner: { statements: string[] }): string[] =>
	runner.statements.filter((statement) => !statement.startsWith('SELECT '));

describe('AddEntitlementLiveLineGrantUniqueIndex1791000003580 (#11023)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('states the rule in each dialect’s own form, over live line grants only', async () => {
		const partial =
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_entitlement_live_line_grant" ON "entitlement" ` +
			`("tenantId", "orderLineId", "kind") WHERE "orderLineId" IS NOT NULL AND "status" <> 'REVOKED' AND "deletedAt" IS NULL`;
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [partial],
			[DatabaseTypeEnum.sqlite]: [partial],
			[DatabaseTypeEnum.betterSqlite3]: [partial],
			[DatabaseTypeEnum.mysql]: [
				"ALTER TABLE `entitlement` ADD COLUMN `liveLineGrantKey` varchar(128) GENERATED ALWAYS AS (IF(`orderLineId` IS NOT NULL AND `status` <> 'REVOKED' AND `deletedAt` IS NULL, CONCAT(`tenantId`, ':', `orderLineId`, ':', `kind`), NULL)) VIRTUAL",
				'CREATE UNIQUE INDEX `UQ_entitlement_live_line_grant` ON `entitlement` (`liveLineGrantKey`)'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(runner as never);

			expect(ddlOf(runner)).toEqual(statements);
		}
	});

	it('probes each dialect’s own catalogue before it creates anything', async () => {
		const probes: Record<string, RegExp> = {
			[DatabaseTypeEnum.postgres]: /FROM pg_indexes WHERE indexname = \$1/,
			[DatabaseTypeEnum.sqlite]: /FROM sqlite_master WHERE type = 'index'/,
			[DatabaseTypeEnum.mysql]: /FROM information_schema\.statistics WHERE table_schema = DATABASE\(\)/
		};

		for (const [type, probe] of Object.entries(probes)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(runner as never);

			expect(runner.statements[0]).toMatch(probe);
			expect(runner.statements[1]).toMatch(/GROUP BY .*HAVING COUNT\(\*\) > 1/);
			expect(runner.statements[1]).toMatch(/tenantId.? IS NOT NULL/);
		}
	});

	it('reuses a MySQL generated column an interrupted run left behind', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.mysql, column: true });

		await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(runner as never);

		expect(ddlOf(runner)).toEqual([
			'CREATE UNIQUE INDEX `UQ_entitlement_live_line_grant` ON `entitlement` (`liveLineGrantKey`)'
		]);
	});

	it('issues no DDL where the index is there, the table is absent or duplicates exist — and never a DELETE or UPDATE', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const present = recordingRunner({ type, index: true });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(present as never);
			expect(ddlOf(present)).toEqual([]);

			const absent = recordingRunner({ type, table: false });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(absent as never);
			expect(absent.statements).toEqual([]);

			const duplicated = recordingRunner({ type, duplicates: ['line-1', 'line-1', 'line-2'] });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(duplicated as never);
			expect(ddlOf(duplicated)).toEqual([]);
			expect(duplicated.statements.join('\n')).not.toMatch(/DELETE|UPDATE/);
		}
	});

	it('names the affected order lines once each when it withholds the index', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, duplicates: ['line-1', 'line-1', 'line-2'] });

		await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(runner as never);

		expect(warn).toHaveBeenCalledTimes(1);
		const message = String(warn.mock.calls[0][0]);
		expect(message).toContain('2 order line(s)');
		expect(message).toContain('line-1, line-2');
		expect(message).toContain('UQ_entitlement_live_line_grant');
	});

	it('drops exactly what it creates, only where it is present', async () => {
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: ['DROP INDEX IF EXISTS "UQ_entitlement_live_line_grant"'],
			[DatabaseTypeEnum.sqlite]: ['DROP INDEX IF EXISTS "UQ_entitlement_live_line_grant"'],
			[DatabaseTypeEnum.mysql]: [
				'DROP INDEX `UQ_entitlement_live_line_grant` ON `entitlement`',
				'ALTER TABLE `entitlement` DROP COLUMN `liveLineGrantKey`'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const present = recordingRunner({ type: type as DatabaseTypeEnum, index: true, column: true });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().down(present as never);
			expect(ddlOf(present)).toEqual(statements);

			const absent = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddEntitlementLiveLineGrantUniqueIndex1791000003580().down(absent as never);
			expect(ddlOf(absent)).toEqual([]);
		}
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddEntitlementLiveLineGrantUniqueIndex1791000003580().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
		await expect(new AddEntitlementLiveLineGrantUniqueIndex1791000003580().down(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('runs after the version column tick, last of the package’s set', () => {
		expect(ENTITLEMENT_MIGRATIONS[ENTITLEMENT_MIGRATIONS.length - 1]).toBe(
			AddEntitlementLiveLineGrantUniqueIndex1791000003580
		);
		expect(ENTITLEMENT_MIGRATIONS.indexOf(AddEntitlementVersionColumn1791000000580)).toBeLessThan(
			ENTITLEMENT_MIGRATIONS.indexOf(AddEntitlementLiveLineGrantUniqueIndex1791000003580)
		);
	});
});

/**
 * #11601 review — a database whose duplicates kept the tick from creating the index is recorded as migrated all the
 * same, so the plugin runs the tick's guarded statements again at every start and tells the grant what it found.
 */
describe('EntitlementLiveLineGrantIndex', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The provider over a TypeORM connection whose query runners are the one given. */
	const providerOver = (runner: object) => {
		const released = jest.fn(async () => undefined);
		const provider = new EntitlementLiveLineGrantIndex({
			manager: { connection: { createQueryRunner: () => ({ ...runner, release: released }) } }
		} as never);

		return { provider, released };
	};

	it('answers from the tick’s own check whether the index is there afterwards', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const migration = new AddEntitlementLiveLineGrantUniqueIndex1791000003580();

			await expect(migration.install(recordingRunner({ type, index: true }) as never)).resolves.toBe(true);
			await expect(migration.install(recordingRunner({ type }) as never)).resolves.toBe(true);
			await expect(migration.install(recordingRunner({ type, duplicates: ['line-1'] }) as never)).resolves.toBe(
				false
			);
			await expect(migration.install(recordingRunner({ type, table: false }) as never)).resolves.toBe(false);
		}
	});

	it('creates the index at start once the duplicates are gone, and tells the grant it is there', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres });
		const { provider, released } = providerOver(runner);

		expect(provider.isPresent()).toBe(false);

		await provider.onApplicationBootstrap();

		expect(ddlOf(runner)).toEqual([
			expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_entitlement_live_line_grant"')
		]);
		expect(provider.isPresent()).toBe(true);
		expect(released).toHaveBeenCalledTimes(1);
	});

	it('withholds it while duplicates remain, says how they are handled meanwhile, and tells the grant it is missing', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, duplicates: ['line-1'] });
		const { provider } = providerOver(runner);

		await expect(provider.refresh()).resolves.toBe(false);

		expect(ddlOf(runner)).toEqual([]);
		expect(provider.isPresent()).toBe(false);
		expect(String(warn.mock.calls[0][0])).toMatch(/locks the line for its transaction/);
		expect(String(warn.mock.calls[0][0])).toMatch(/next start of the API creates the index/);
	});

	it('answers "missing" when the check itself fails, logs why, and still releases the runner', async () => {
		const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		const { provider, released } = providerOver({
			connection: { options: { type: DatabaseTypeEnum.postgres } },
			hasTable: async () => {
				throw new Error('permission denied for table entitlement');
			}
		});

		await expect(provider.refresh()).resolves.toBe(false);

		expect(provider.isPresent()).toBe(false);
		expect(String(error.mock.calls[0][0])).toContain('permission denied for table entitlement');
		expect(released).toHaveBeenCalledTimes(1);
	});
});
