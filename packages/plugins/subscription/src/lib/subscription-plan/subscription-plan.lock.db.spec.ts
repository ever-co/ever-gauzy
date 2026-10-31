import { DataSource, QueryRunner } from 'typeorm';
import { lockPlanRow } from './subscription-plan.lock';

/**
 * The plan row lock on real databases, with two connections: a lock is held until its transaction ends, a plan update
 * and a subscription created on the plan wait for one another in either order and then see what the other committed,
 * a plan update waits for a mid-cycle change reserving the plan and then counts the reservation, and two subscriptions
 * created on one plan do not wait for one another.
 *
 * Postgres and MySQL run when `SUBSCRIPTION_TEST_POSTGRES_URL` / `SUBSCRIPTION_TEST_MYSQL_URL` point at an empty,
 * disposable database (the build-api job's service containers); SQLite, which has no row locks, always runs.
 */
type Dialect = 'postgres' | 'mysql';

const postgresUrl = process.env['SUBSCRIPTION_TEST_POSTGRES_URL'];
const mysqlUrl = process.env['SUBSCRIPTION_TEST_MYSQL_URL'];
const TARGETS: Array<{ name: Dialect; url: string }> = [
	...(postgresUrl ? [{ name: 'postgres' as const, url: postgresUrl }] : []),
	...(mysqlUrl ? [{ name: 'mysql' as const, url: mysqlUrl }] : [])
];

const PLAN = '0b6a52f4-6a3c-4c47-9d2b-1f0d6c1f5a01';
/** Postgres runs in a schema of its own, so the suite never meets a `subscription_plan` another suite created. */
const PG_SCHEMA = 'subscription_lock_test';
/** Long enough for a lock request nothing blocks to be granted; a blocked one is still waiting after it. */
const BLOCKED_MS = 750;
/** How long a request may take once the holder has committed. */
const GRANTED_MS = 10_000;

/**
 * @param promise The lock request.
 * @param ms How long to wait for it.
 * @returns Whether it was granted within `ms`; a request that fails fails the case.
 */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<false>((resolve) => {
		timer = setTimeout(() => resolve(false), ms);
	});

	try {
		return await Promise.race([promise.then(() => true), timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * @param name The database.
 * @param url Where it is.
 * @returns A data source with a connection pool, so each transaction of a case gets a connection of its own; on
 * Postgres inside the suite's own schema.
 */
async function openDataSource(name: Dialect, url: string): Promise<DataSource> {
	if (name === 'postgres') {
		const setup = await new DataSource({ type: 'postgres', url } as never).initialize();
		await setup.query(`CREATE SCHEMA IF NOT EXISTS "${PG_SCHEMA}"`);
		await setup.destroy();

		return await new DataSource({
			type: 'postgres',
			url,
			schema: PG_SCHEMA,
			extra: { options: `-c search_path=${PG_SCHEMA}` }
		} as never).initialize();
	}

	return await new DataSource({ type: 'mysql', url } as never).initialize();
}

describe('lockPlanRow on SQLite', () => {
	it('runs no statement: SQLite has a single writer and no row locks', async () => {
		const dataSource = await new DataSource({ type: 'better-sqlite3', database: ':memory:' }).initialize();

		try {
			const query = jest.spyOn(dataSource.manager, 'query');

			// There is no `subscription_plan` table, so a statement would fail.
			await lockPlanRow(dataSource.manager, PLAN, 'update');
			await lockPlanRow(dataSource.manager, PLAN, 'share');
			expect(query).not.toHaveBeenCalled();
		} finally {
			await dataSource.destroy();
		}
	});
});

for (const { name, url } of TARGETS) {
	describe(`lockPlanRow on ${name}, two connections`, () => {
		let dataSource: DataSource;
		const open: QueryRunner[] = [];
		const t = (identifier: string) => (name === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`);
		const mark = (position: number) => (name === 'postgres' ? `$${position}` : '?');

		/** Opens a transaction on a connection of its own, as two requests to the API do. */
		const transaction = async (): Promise<QueryRunner> => {
			const runner = dataSource.createQueryRunner();

			open.push(runner);
			await runner.connect();
			await runner.startTransaction();

			return runner;
		};
		const currencyAsSeenBy = async (runner: QueryRunner): Promise<string> =>
			(await runner.query(`SELECT ${t('currency')} FROM ${t('subscription_plan')} WHERE ${t('id')} = ${mark(1)}`, [PLAN]))[0]
				.currency;
		const setCurrency = async (runner: QueryRunner, currency: string) =>
			await runner.query(`UPDATE ${t('subscription_plan')} SET ${t('currency')} = ${mark(1)} WHERE ${t('id')} = ${mark(2)}`, [
				currency,
				PLAN
			]);
		const subscribe = async (runner: QueryRunner, id: string) =>
			await runner.query(`INSERT INTO ${t('subscription_lock_probe')} (${t('id')}, ${t('planId')}) VALUES (${mark(1)}, ${mark(2)})`, [
				id,
				PLAN
			]);
		const subscriptionsAsSeenBy = async (runner: QueryRunner): Promise<number> =>
			Number(
				(await runner.query(`SELECT COUNT(*) AS ${t('n')} FROM ${t('subscription_lock_probe')} WHERE ${t('planId')} = ${mark(1)}`, [PLAN]))[0].n
			);
		/** A mid-cycle change reserving the plan for a subscription still on another one (`reserveChange`). */
		const reserve = async (runner: QueryRunner, id: string) =>
			await runner.query(`UPDATE ${t('subscription_lock_probe')} SET ${t('reservedPlanId')} = ${mark(1)} WHERE ${t('id')} = ${mark(2)}`, [
				PLAN,
				id
			]);
		/** What `hasLiveSubscriptions` counts: the subscriptions on the plan, and those a change is moving onto it. */
		const holdersAsSeenBy = async (runner: QueryRunner): Promise<number> =>
			Number(
				(
					await runner.query(
						`SELECT COUNT(*) AS ${t('n')} FROM ${t('subscription_lock_probe')} WHERE ${t('planId')} = ${mark(1)} OR ${t('reservedPlanId')} = ${mark(2)}`,
						[PLAN, PLAN]
					)
				)[0].n
			);

		beforeAll(async () => {
			dataSource = await openDataSource(name, url);

			for (const table of ['subscription_lock_probe', 'subscription_plan']) {
				await dataSource.query(`DROP TABLE IF EXISTS ${t(table)}`);
			}

			await dataSource.query(
				`CREATE TABLE ${t('subscription_plan')} (${t('id')} varchar(64) PRIMARY KEY, ${t('currency')} varchar(3) NOT NULL)`
			);
			// Stands for the `subscription` rows a plan update's live-subscription check counts.
			await dataSource.query(
				`CREATE TABLE ${t('subscription_lock_probe')} (${t('id')} varchar(64) PRIMARY KEY, ${t('planId')} varchar(64) NOT NULL, ${t('reservedPlanId')} varchar(64) NULL)`
			);
		}, 60_000);

		beforeEach(async () => {
			await dataSource.query(`DELETE FROM ${t('subscription_lock_probe')}`);
			await dataSource.query(`DELETE FROM ${t('subscription_plan')}`);
			await dataSource.query(`INSERT INTO ${t('subscription_plan')} (${t('id')}, ${t('currency')}) VALUES (${mark(1)}, ${mark(2)})`, [
				PLAN,
				'USD'
			]);
		});

		afterEach(async () => {
			// A case that failed half-way must not leave a transaction holding the row for the next one.
			for (const runner of open.splice(0)) {
				if (runner.isTransactionActive) {
					await runner.rollbackTransaction().catch(() => undefined);
				}

				if (!runner.isReleased) {
					await runner.release();
				}
			}
		});

		afterAll(async () => {
			if (!dataSource?.isInitialized) {
				return;
			}

			for (const table of ['subscription_lock_probe', 'subscription_plan']) {
				await dataSource.query(`DROP TABLE IF EXISTS ${t(table)}`);
			}

			if (name === 'postgres') {
				await dataSource.query(`DROP SCHEMA IF EXISTS "${PG_SCHEMA}" CASCADE`);
			}

			await dataSource.destroy();
		});

		it('a plan update waits for a subscription being created on the plan, then counts it', async () => {
			const creation = await transaction();

			await lockPlanRow(creation.manager, PLAN, 'share');
			await subscribe(creation, 'created-first');

			const update = await transaction();
			const updateLocked = lockPlanRow(update.manager, PLAN, 'update');

			// The share lock outlives the statement that took it: it is held until the creation commits.
			expect(await settlesWithin(updateLocked, BLOCKED_MS)).toBe(false);

			await creation.commitTransaction();

			expect(await settlesWithin(updateLocked, GRANTED_MS)).toBe(true);
			expect(await subscriptionsAsSeenBy(update)).toBe(1);

			await update.commitTransaction();
		}, 30_000);

		it('a plan update waits for a change reserving the plan, then counts the reservation', async () => {
			// A subscription on another plan, which a mid-cycle change is about to move onto this one.
			await dataSource.query(`INSERT INTO ${t('subscription_lock_probe')} (${t('id')}, ${t('planId')}) VALUES (${mark(1)}, ${mark(2)})`, [
				'moving',
				'another-plan'
			]);

			const change = await transaction();

			await lockPlanRow(change.manager, PLAN, 'share');
			await reserve(change, 'moving');

			const update = await transaction();
			const updateLocked = lockPlanRow(update.manager, PLAN, 'update');

			expect(await settlesWithin(updateLocked, BLOCKED_MS)).toBe(false);

			await change.commitTransaction();

			expect(await settlesWithin(updateLocked, GRANTED_MS)).toBe(true);
			// Counting the plan's subscriptions alone finds none: the reservation is what holds the plan.
			expect(await subscriptionsAsSeenBy(update)).toBe(0);
			expect(await holdersAsSeenBy(update)).toBe(1);

			await update.commitTransaction();
		}, 30_000);

		it('a subscription being created waits for a plan update, then reads the plan as the update left it', async () => {
			const update = await transaction();

			await lockPlanRow(update.manager, PLAN, 'update');
			await setCurrency(update, 'EUR');

			const creation = await transaction();
			const creationLocked = lockPlanRow(creation.manager, PLAN, 'share');

			expect(await settlesWithin(creationLocked, BLOCKED_MS)).toBe(false);

			await update.commitTransaction();

			expect(await settlesWithin(creationLocked, GRANTED_MS)).toBe(true);
			expect(await currencyAsSeenBy(creation)).toBe('EUR');

			await creation.commitTransaction();
		}, 30_000);

		it('a plan update waits for another, then reads what that one wrote', async () => {
			const first = await transaction();

			await lockPlanRow(first.manager, PLAN, 'update');
			await setCurrency(first, 'EUR');

			const second = await transaction();
			const secondLocked = lockPlanRow(second.manager, PLAN, 'update');

			expect(await settlesWithin(secondLocked, BLOCKED_MS)).toBe(false);

			await first.commitTransaction();

			expect(await settlesWithin(secondLocked, GRANTED_MS)).toBe(true);
			// `updatePlan` reads the plan again at this point, so it writes over EUR rather than the USD it read first.
			expect(await currencyAsSeenBy(second)).toBe('EUR');

			await second.commitTransaction();
		}, 30_000);

		it('a plan update rolled back releases the row, and the waiting creation sees the plan unchanged', async () => {
			const update = await transaction();

			await lockPlanRow(update.manager, PLAN, 'update');
			await setCurrency(update, 'EUR');

			const creation = await transaction();
			const creationLocked = lockPlanRow(creation.manager, PLAN, 'share');

			expect(await settlesWithin(creationLocked, BLOCKED_MS)).toBe(false);

			await update.rollbackTransaction();

			expect(await settlesWithin(creationLocked, GRANTED_MS)).toBe(true);
			expect(await currencyAsSeenBy(creation)).toBe('USD');

			await creation.commitTransaction();
		}, 30_000);

		it('two subscriptions created on one plan do not wait for one another', async () => {
			const first = await transaction();

			await lockPlanRow(first.manager, PLAN, 'share');

			const second = await transaction();

			expect(await settlesWithin(lockPlanRow(second.manager, PLAN, 'share'), GRANTED_MS)).toBe(true);

			await subscribe(first, 'first');
			await subscribe(second, 'second');
			await first.commitTransaction();
			await second.commitTransaction();

			expect(await subscriptionsAsSeenBy(await transaction())).toBe(2);
		}, 30_000);
	});
}
