/**
 * The tick that gives a cart its guest-access token digest.
 *
 * A migration is judged by what it issues on a database in each of the states a real installation
 * reaches, so the runner below is a recording double rather than a database: the statements are
 * asserted, the catalogue probes are answered, and nothing is executed. What the suite pins is the whole
 * of the file's contract — the column and its unique index are stated in each dialect's own form where
 * they are missing, nothing at all is issued where they are already there, `down` reverses exactly what
 * `up` can have changed and in the order SQLite needs, and a dialect the file has no statements for is
 * refused rather than silently skipped.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites state: its
 * barrel boots the whole application graph, which importing the migration set would otherwise do. The
 * migration under test calls nothing in it.
 */
jest.mock('@gauzy/core', () => ({}));

import { DatabaseTypeEnum } from '@gauzy/config';
import { ALL_CART_MIGRATIONS } from './cart-migrations';
import { AddCartTokenHashColumn1791000000630 } from './migrations/1791000000630-AddCartTokenHashColumn';

/** The index the tick creates, by the name every dialect gives it. */
const INDEX = 'UQ_commerce_cart_token_hash';

/**
 * A query runner that records what a migration asked for.
 *
 * @param state The dialect, and whether the cart table already carries the column and the index.
 */
function recordingRunner(state: { type: DatabaseTypeEnum; column?: boolean; index?: boolean }) {
	const statements: string[] = [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasColumn: async (table: string, column: string) =>
			table === 'commerce_cart' && column === 'tokenHash' && state.column === true,
		getTable: async (table: string) =>
			table === 'commerce_cart' ? { indices: state.index ? [{ name: INDEX }] : [{ name: 'IDX_commerce_cart_version' }] } : undefined,
		query: async (sql: string) => {
			statements.push(sql);

			return [];
		}
	};
}

describe('AddCartTokenHashColumn1791000000630 — what it issues', () => {
	it('adds the nullable digest column and a partial unique index over it on Postgres', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres });

		await new AddCartTokenHashColumn1791000000630().up(runner as never);

		expect(runner.statements).toEqual([
			'ALTER TABLE "commerce_cart" ADD COLUMN "tokenHash" character varying(64)',
			`CREATE UNIQUE INDEX "${INDEX}" ON "commerce_cart" ("tokenHash") WHERE "tokenHash" IS NOT NULL`
		]);
		// Nullable: every cart created before this tick has no token and cannot be given one afterwards.
		expect(runner.statements[0]).not.toMatch(/NOT NULL/);
	});

	it('states the same column and index in SQLite’s and MySQL’s own forms', async () => {
		const sqlite = recordingRunner({ type: DatabaseTypeEnum.betterSqlite3 });

		await new AddCartTokenHashColumn1791000000630().up(sqlite as never);

		expect(sqlite.statements).toEqual([
			'ALTER TABLE "commerce_cart" ADD COLUMN "tokenHash" varchar(64)',
			`CREATE UNIQUE INDEX "${INDEX}" ON "commerce_cart" ("tokenHash") WHERE "tokenHash" IS NOT NULL`
		]);

		const mysql = recordingRunner({ type: DatabaseTypeEnum.mysql });

		await new AddCartTokenHashColumn1791000000630().up(mysql as never);

		// MySQL has no partial index; its unique index never compares two NULLs, which is the same exemption.
		expect(mysql.statements).toEqual([
			'ALTER TABLE `commerce_cart` ADD COLUMN `tokenHash` varchar(64) NULL',
			`CREATE UNIQUE INDEX \`${INDEX}\` ON \`commerce_cart\` (\`tokenHash\`)`
		]);
	});

	it('issues nothing on a database that already carries the column and the index', async () => {
		// The property that makes `up` safe to run twice, or to replay onto a restored snapshot.
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const runner = recordingRunner({ type, column: true, index: true });

			await new AddCartTokenHashColumn1791000000630().up(runner as never);

			expect(runner.statements).toEqual([]);
		}
	});

	it('adds only the index when an earlier, interrupted run left the column behind', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, column: true });

		await new AddCartTokenHashColumn1791000000630().up(runner as never);

		expect(runner.statements).toEqual([
			`CREATE UNIQUE INDEX "${INDEX}" ON "commerce_cart" ("tokenHash") WHERE "tokenHash" IS NOT NULL`
		]);
	});

	it('reverses the index before the column, on every dialect', async () => {
		// SQLite refuses to drop a column an index still names, so the order is the contract.
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [`DROP INDEX "${INDEX}"`, 'ALTER TABLE "commerce_cart" DROP COLUMN "tokenHash"'],
			[DatabaseTypeEnum.sqlite]: [`DROP INDEX "${INDEX}"`, 'ALTER TABLE "commerce_cart" DROP COLUMN "tokenHash"'],
			[DatabaseTypeEnum.mysql]: [
				`DROP INDEX \`${INDEX}\` ON \`commerce_cart\``,
				'ALTER TABLE `commerce_cart` DROP COLUMN `tokenHash`'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum, column: true, index: true });

			await new AddCartTokenHashColumn1791000000630().down(runner as never);

			expect(runner.statements).toEqual(statements);
		}
	});

	it('reverses nothing that is already gone', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres });

		await new AddCartTokenHashColumn1791000000630().down(runner as never);

		expect(runner.statements).toEqual([]);
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddCartTokenHashColumn1791000000630().up(runner as never)).rejects.toThrow(/Unsupported database/);
		await expect(new AddCartTokenHashColumn1791000000630().down(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('is the last tick of the plugin’s set, and its name is its class’s', () => {
		// A migration's timestamp is frozen once it has shipped, so this one runs after every file the set
		// already holds and cannot be inserted between two of them.
		expect(ALL_CART_MIGRATIONS[ALL_CART_MIGRATIONS.length - 1]).toBe(AddCartTokenHashColumn1791000000630);
		expect(new AddCartTokenHashColumn1791000000630().name).toBe(AddCartTokenHashColumn1791000000630.name);
	});
});
