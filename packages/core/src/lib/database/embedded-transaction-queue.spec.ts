import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, DataSourceOptions, EntityManager, EntitySchema, Logger } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DatabaseModule } from './database.module';
import {
	EmbeddedTransactionWaitTimeoutError,
	hasEmbeddedTransactionQueue,
	IEmbeddedTransactionQueueOptions,
	serializeEmbeddedTransactions
} from './embedded-transaction-queue';

/**
 * The SQLite binding, required rather than imported: the type is imported and the value is required,
 * so nothing loads a native binding at module-parse time.
 */
const Sqlite: typeof import('better-sqlite3') = require('better-sqlite3');

/**
 * Two requests' transactions on SQLite, each its own.
 *
 * TypeORM's better-sqlite3 driver hands every caller the same query runner, so without the queue two
 * independent transactions drive one `BEGIN` / `SAVEPOINT` / `COMMIT` bookkeeping between them — see
 * embedded-transaction-queue.ts for what that did, measured. Everything here runs against a real
 * better-sqlite3 database, because the defect is in what reaches the connection: a mocked runner would
 * only restate whichever order the code under test chose.
 *
 * What a transaction committed is read through a SECOND connection to the same file, never through the
 * data source itself. The data source's one connection also answers reads inside whichever transaction
 * holds it, so it would report rows that are not committed — which is the defect's own symptom, and no
 * way to observe it.
 */

/** The row every transaction below writes: an id that says who wrote it. */
class QueueRow {
	id!: string;
	tag!: string;
}

/** The MikroORM twin, a class of its own so neither ORM's metadata can reach the other's. */
class MikroQueueRow {
	id!: string;
	tag!: string;
}

const TypeOrmQueueRow = new EntitySchema<QueueRow>({
	name: 'QueueRow',
	tableName: 'queue_row',
	target: QueueRow,
	columns: {
		id: { primary: true, type: 'varchar' },
		tag: { type: 'varchar' }
	}
});

const MikroOrmQueueRow = new MikroEntitySchema<MikroQueueRow>({
	class: MikroQueueRow,
	tableName: 'queue_row',
	properties: {
		id: { type: 'string', primary: true },
		tag: { type: 'string' }
	}
});

/** Lets every other piece of pending work run, the way an awaited I/O call does between two statements. */
const tick = (): Promise<void> => new Promise<void>((resolve) => setImmediate(resolve));

/** A promise settled either way, so a rejection can be inspected next to a result. */
async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: Error }> {
	try {
		return { value: await promise };
	} catch (error) {
		return { error: error as Error };
	}
}

/** A database file of its own for one test, and the rows committed to it. */
class DatabaseFile {
	private readonly directory = mkdtempSync(join(tmpdir(), 'gauzy-transaction-queue-'));
	readonly path = join(this.directory, 'queue.sqlite3');

	/**
	 * The rows committed to the file, read through a connection of their own.
	 *
	 * @returns The ids, in order.
	 */
	committed(): string[] {
		return this.committedRows().map((row) => row.id);
	}

	/**
	 * The rows committed to the file with what they say, read through a connection of their own.
	 *
	 * @returns The rows, in id order.
	 */
	committedRows(): QueueRow[] {
		const reader = new Sqlite(this.path, { readonly: true, fileMustExist: true });

		try {
			return reader.prepare('SELECT id, tag FROM queue_row ORDER BY id').all() as QueueRow[];
		} finally {
			reader.close();
		}
	}

	remove(): void {
		rmSync(this.directory, { recursive: true, force: true });
	}
}

/**
 * The statements that decide what a transaction is — its brackets, and the rows it writes — in the
 * order the connection received them. A parameterised insert is recorded by the id it writes.
 *
 * `everything` keeps every statement with its parameters, for comparing what two data sources sent.
 */
class StatementLog implements Logger {
	readonly statements: string[] = [];
	readonly everything: string[] = [];

	logQuery(query: string, parameters?: unknown[]): void {
		this.everything.push(`${query} -- ${JSON.stringify(parameters ?? [])}`);

		if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(query)) {
			this.statements.push(query);
		} else if (/^INSERT INTO "queue_row"/.test(query) && parameters?.length) {
			this.statements.push(`INSERT ${parameters[0]}`);
		}
	}

	logQueryError(): void {
		// A failed statement is asserted through the promise it rejects, not through the log.
	}

	logQuerySlow(): void {
		// Timing is not what these tests are about.
	}

	logSchemaBuild(): void {
		// The schema is built before every test and is not part of it.
	}

	logMigration(): void {
		// No migration runs here.
	}

	log(): void {
		// Nothing else TypeORM reports is read.
	}

	/** Forgets what the schema setup logged. */
	clear(): void {
		this.statements.length = 0;
		this.everything.length = 0;
	}
}

/** One TypeORM data source over its own file. */
interface ITypeOrmStore {
	readonly dataSource: DataSource;
	readonly file: DatabaseFile;
	readonly log: StatementLog;
}

/** The options every TypeORM data source below is built with. */
function typeOrmOptions(file: DatabaseFile, log: StatementLog): DataSourceOptions {
	return {
		type: 'better-sqlite3',
		database: file.path,
		entities: [TypeOrmQueueRow],
		synchronize: true,
		logging: ['query'],
		logger: log
	};
}

/**
 * Opens a data source the way the platform does: the queue installed before it is initialized.
 *
 * @param options How long a transaction waits for the connection.
 * @param queued False for a data source exactly as TypeORM builds it, without the queue.
 * @returns The store.
 */
async function openTypeOrm(options?: IEmbeddedTransactionQueueOptions, queued = true): Promise<ITypeOrmStore> {
	const file = new DatabaseFile();
	const log = new StatementLog();
	const built = new DataSource(typeOrmOptions(file, log));
	const dataSource = queued ? serializeEmbeddedTransactions(built, options) : built;

	await dataSource.initialize();
	log.clear();

	return { dataSource, file, log };
}

async function closeTypeOrm(store: ITypeOrmStore | undefined): Promise<void> {
	if (store?.dataSource.isInitialized) {
		await store.dataSource.destroy();
	}
	store?.file.remove();
}

/**
 * A transaction that writes two rows with pending work between its statements, as a request's does.
 *
 * @param manager The manager it is opened on.
 * @param tag Who writes: the rows are `<tag>1` and `<tag>2`.
 * @param fail Whether it fails after writing both.
 */
function writeTwo(manager: EntityManager | DataSource, tag: string, fail = false): Promise<string> {
	return manager.transaction(async (transactional) => {
		await transactional.insert(QueueRow, { id: `${tag}1`, tag });
		await tick();
		await transactional.insert(QueueRow, { id: `${tag}2`, tag });
		await tick();

		if (fail) {
			throw new Error(`${tag} fails`);
		}

		return tag;
	});
}

/** The statements of one transaction that writes `<tag>1` and `<tag>2` and commits. */
const committedBlock = (tag: string): string[] => ['BEGIN TRANSACTION', `INSERT ${tag}1`, `INSERT ${tag}2`, 'COMMIT'];

/** A transaction left open part-way through, the way a request's is while it awaits other work. */
interface IHeldTransaction {
	/** Settled once the transaction has written its first row, `<tag>1`. */
	readonly written: Promise<void>;
	/** Lets the transaction go on: to commit, or to fail and roll back. */
	letGo(outcome: 'commit' | 'fail'): void;
	/** How the transaction ended. */
	readonly ended: Promise<{ value?: string; error?: Error }>;
}

/**
 * Opens a transaction that writes `<tag>1` and then stays open until it is let go.
 *
 * @param manager The manager it is opened on.
 * @param tag Who writes.
 * @returns The transaction's handles.
 */
function holdOpen(manager: EntityManager, tag: string): IHeldTransaction {
	let written!: () => void;
	let letGo!: (outcome: 'commit' | 'fail') => void;
	const hasWritten = new Promise<void>((resolve) => (written = resolve));
	const outcome = new Promise<'commit' | 'fail'>((resolve) => (letGo = resolve));

	const ended = settle(
		manager.transaction(async (transactional) => {
			await transactional.insert(QueueRow, { id: `${tag}1`, tag });
			written();

			if ((await outcome) === 'fail') {
				throw new Error(`${tag} fails`);
			}

			return tag;
		})
	);

	return { written: hasWritten, letGo, ended };
}

/**
 * Whether a promise is still unsettled after every other piece of pending work has had several turns —
 * long enough for any statement that was not waiting to have run.
 */
async function stillPending(promise: Promise<unknown>): Promise<boolean> {
	let settled = false;
	promise.then(
		() => (settled = true),
		() => (settled = true)
	);

	for (let turn = 0; turn < 5; turn++) {
		await tick();
	}

	return !settled;
}

/** The ids of the rows a read answered — a raw `SELECT "id"` or a repository's `find()`. */
const idsOf = (rows: Array<{ id: string }>): string[] => rows.map((row) => row.id);

describe('serializeEmbeddedTransactions — TypeORM on better-sqlite3', () => {
	let store: ITypeOrmStore | undefined;

	afterEach(async () => {
		await closeTypeOrm(store);
		store = undefined;
	});

	it('lets two transactions opened in the same tick each commit their own rows', async () => {
		// Without the queue both issued BEGIN: the second failed, its ROLLBACK ended the first one's
		// transaction, and both reported failure while the first one's rows were stored anyway.
		store = await openTypeOrm();

		const results = await Promise.all([
			writeTwo(store.dataSource.manager, 'a'),
			writeTwo(store.dataSource, 'b') // DataSource.transaction, which delegates to its manager
		]);

		expect(results).toEqual(['a', 'b']);
		expect(store.file.committed()).toEqual(['a1', 'a2', 'b1', 'b2']);
		expect(store.log.statements).toEqual([...committedBlock('a'), ...committedBlock('b')]);
	});

	it('rolls back only the failing one of two transactions opened in the same tick', async () => {
		store = await openTypeOrm();

		const [first, second] = await Promise.all([
			settle(writeTwo(store.dataSource.manager, 'a', true)),
			settle(writeTwo(store.dataSource.manager, 'b'))
		]);

		expect(first.error?.message).toBe('a fails');
		expect(second.value).toBe('b');
		expect(store.file.committed()).toEqual(['b1', 'b2']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT a1',
			'INSERT a2',
			'ROLLBACK',
			...committedBlock('b')
		]);
	});

	it('does not run a later transaction as a savepoint of an earlier one, so its rollback cannot undo the earlier commit', async () => {
		// Without the queue the second one became SAVEPOINT typeorm_1: the first one's commit only released
		// it, so nothing was committed when the first one reported success, and the second one's ROLLBACK
		// then removed the first one's row as well.
		store = await openTypeOrm();
		const manager = store.dataSource.manager;

		let letSecondFail!: () => void;
		const secondMayFail = new Promise<void>((resolve) => (letSecondFail = resolve));

		const first = manager.transaction(async (transactional) => {
			await transactional.insert(QueueRow, { id: 'a1', tag: 'a' });
			await tick();
			await tick();
			return 'a';
		});
		await tick();
		const second = settle(
			manager.transaction(async (transactional) => {
				await transactional.insert(QueueRow, { id: 'b1', tag: 'b' });
				await secondMayFail;
				throw new Error('b fails');
			})
		);

		await expect(first).resolves.toBe('a');
		expect(store.file.committed()).toEqual(['a1']);

		letSecondFail();
		expect((await second).error?.message).toBe('b fails');
		expect(store.file.committed()).toEqual(['a1']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT a1',
			'COMMIT',
			'BEGIN TRANSACTION',
			'INSERT b1',
			'ROLLBACK'
		]);
	});

	it('keeps a transaction opened inside another a savepoint of it, while a second request waits its turn', async () => {
		// Nested through the manager the callback was handed, through the data source's own manager and
		// through the data source: each is a savepoint of the transaction holding the connection, and none
		// waits for it — a transaction that queued behind itself would never finish.
		store = await openTypeOrm();
		const dataSource = store.dataSource;

		const outer = dataSource.manager.transaction(async (manager) => {
			await manager.insert(QueueRow, { id: 'o1', tag: 'o' });
			const failedInner = await settle(
				manager.transaction(async (inner) => {
					await inner.insert(QueueRow, { id: 'i1', tag: 'i' });
					throw new Error('inner fails');
				})
			);
			await tick();
			await dataSource.manager.transaction((inner) => inner.insert(QueueRow, { id: 'i2', tag: 'i' }));
			await dataSource.transaction((inner) => inner.insert(QueueRow, { id: 'i3', tag: 'i' }));
			// A save through a repository of the data source joins the transaction its caller holds.
			await dataSource.getRepository(QueueRow).save({ id: 'i4', tag: 'i' });

			return failedInner.error?.message;
		});
		const other = writeTwo(dataSource.manager, 'b');

		await expect(Promise.all([outer, other])).resolves.toEqual(['inner fails', 'b']);
		expect(store.file.committed()).toEqual(['b1', 'b2', 'i2', 'i3', 'i4', 'o1']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT o1',
			'SAVEPOINT typeorm_1',
			'INSERT i1',
			'ROLLBACK TO SAVEPOINT typeorm_1',
			'SAVEPOINT typeorm_1',
			'INSERT i2',
			'RELEASE SAVEPOINT typeorm_1',
			'SAVEPOINT typeorm_1',
			'INSERT i3',
			'RELEASE SAVEPOINT typeorm_1',
			'INSERT i4',
			'COMMIT',
			...committedBlock('b')
		]);
	});

	it('queues a transaction opened by hand on a query runner, and keeps the one it opens inside a savepoint', async () => {
		// The pattern a command handler uses: its own runner, started by hand, with a second handler that
		// does the same from inside it. Without the queue the second flow's BEGIN failed.
		store = await openTypeOrm();
		const dataSource = store.dataSource;

		const byHand = async (tag: string): Promise<string> => {
			const runner = dataSource.createQueryRunner();
			await runner.connect();
			await runner.startTransaction();

			try {
				await runner.manager.insert(QueueRow, { id: `${tag}1`, tag });
				await tick();

				const inner = dataSource.createQueryRunner();
				await inner.connect();
				await inner.startTransaction();
				await inner.manager.insert(QueueRow, { id: `${tag}2`, tag });
				await inner.commitTransaction();

				await runner.commitTransaction();
				return tag;
			} catch (error) {
				await runner.rollbackTransaction();
				throw error;
			} finally {
				await runner.release();
			}
		};

		await expect(Promise.all([byHand('a'), byHand('b')])).resolves.toEqual(['a', 'b']);
		expect(store.file.committed()).toEqual(['a1', 'a2', 'b1', 'b2']);
		const block = (tag: string) => [
			'BEGIN TRANSACTION',
			`INSERT ${tag}1`,
			'SAVEPOINT typeorm_1',
			`INSERT ${tag}2`,
			'RELEASE SAVEPOINT typeorm_1',
			'COMMIT'
		];
		expect(store.log.statements).toEqual([...block('a'), ...block('b')]);
	});

	it("gives a save made while another request's transaction is open a transaction of its own", async () => {
		// Without the queue the save read the shared runner's `isTransactionActive`, skipped the
		// transaction it would have opened, and was rolled back with the other request's.
		store = await openTypeOrm();
		const dataSource = store.dataSource;

		const failing = dataSource.manager.transaction(async (manager) => {
			await manager.insert(QueueRow, { id: 'a1', tag: 'a' });
			await tick();
			await tick();
			await tick();
			throw new Error('a fails');
		});
		await tick();
		const saved = dataSource.getRepository(QueueRow).save({ id: 'c1', tag: 'c' });

		const [first, save] = await Promise.all([settle(failing), settle(saved)]);

		expect(first.error?.message).toBe('a fails');
		expect(save.value).toMatchObject({ id: 'c1' });
		expect(store.file.committed()).toEqual(['c1']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT a1',
			'ROLLBACK',
			'BEGIN TRANSACTION',
			'INSERT c1',
			'COMMIT'
		]);
	});

	it('gives up waiting after the time it is allowed, without ending the transaction it waited for', async () => {
		store = await openTypeOrm({ waitTimeoutMs: 50 });
		const dataSource = store.dataSource;

		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));

		const holder = dataSource.manager.transaction(async (manager) => {
			await manager.insert(QueueRow, { id: 'a1', tag: 'a' });
			await held;
			await manager.insert(QueueRow, { id: 'a2', tag: 'a' });
			return 'a';
		});
		await tick();

		// The waiter's own rollback runs while the holder's transaction is open: TypeORM refuses it, because
		// the transaction on the connection is not the waiter's.
		const waiter = await settle(
			dataSource.transaction((manager) => manager.insert(QueueRow, { id: 'b1', tag: 'b' }))
		);
		expect(waiter.error).toBeInstanceOf(EmbeddedTransactionWaitTimeoutError);

		release();
		await expect(holder).resolves.toBe('a');
		await dataSource.transaction((manager) => manager.insert(QueueRow, { id: 'c1', tag: 'c' }));

		expect(store.file.committed()).toEqual(['a1', 'a2', 'c1']);
		expect(store.log.statements).toEqual([...committedBlock('a'), 'BEGIN TRANSACTION', 'INSERT c1', 'COMMIT']);
	});

	it('starts afresh after SQLite rolled a transaction back on its own', async () => {
		// `INSERT OR ROLLBACK` ends the transaction inside SQLite, so TypeORM's ROLLBACK then fails and its
		// runner went on believing a transaction was open: every later transaction became a savepoint of
		// nothing, and the first one to fail left the connection inside a transaction nothing would commit.
		store = await openTypeOrm();
		const dataSource = store.dataSource;
		await dataSource.manager.insert(QueueRow, { id: 'x', tag: 'x' });

		const rolledBackBySqlite = await settle(
			dataSource.manager.transaction(async (manager) => {
				await manager.insert(QueueRow, { id: 'f1', tag: 'f' });
				await manager.query(`INSERT OR ROLLBACK INTO "queue_row" ("id", "tag") VALUES ('x', 'again')`);
			})
		);
		expect(rolledBackBySqlite.error?.message).toMatch(/UNIQUE constraint failed/);
		store.log.clear();

		await dataSource.transaction((manager) => manager.insert(QueueRow, { id: 'n1', tag: 'n' }));
		const failing = await settle(
			dataSource.transaction(async (manager) => {
				await manager.insert(QueueRow, { id: 'n2', tag: 'n' });
				throw new Error('n2 fails');
			})
		);

		expect(failing.error?.message).toBe('n2 fails');
		expect(
			(dataSource.driver as unknown as { databaseConnection: { inTransaction: boolean } }).databaseConnection
				.inTransaction
		).toBe(false);
		expect(store.file.committed()).toEqual(['n1', 'x']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT n1',
			'COMMIT',
			'BEGIN TRANSACTION',
			'INSERT n2',
			'ROLLBACK'
		]);
	});

	it('installs on a data source that is already initialized, and a second install changes nothing', async () => {
		const file = new DatabaseFile();
		const log = new StatementLog();
		const dataSource = new DataSource(typeOrmOptions(file, log));
		store = { dataSource, file, log };

		await dataSource.initialize();
		// The shared runner exists already: initialize created it for the schema.
		serializeEmbeddedTransactions(dataSource);
		const transaction = dataSource.manager.transaction;
		serializeEmbeddedTransactions(dataSource);
		log.clear();

		expect(hasEmbeddedTransactionQueue(dataSource)).toBe(true);
		expect(dataSource.manager.transaction).toBe(transaction);
		await expect(Promise.all([writeTwo(dataSource, 'a'), writeTwo(dataSource, 'b')])).resolves.toEqual(['a', 'b']);
		expect(log.statements).toEqual([...committedBlock('a'), ...committedBlock('b')]);
	});
});

/**
 * A single statement outside any transaction — a read, a repository's `insert()`, `update()` or
 * `delete()`, a query builder's `execute()`, `DataSource.query` — on the same shared runner. Without the
 * gate it ran on the connection the moment it came, and so inside whichever request's transaction was
 * open there.
 */
describe('serializeEmbeddedTransactions — statements outside a transaction, TypeORM on better-sqlite3', () => {
	let store: ITypeOrmStore | undefined;

	afterEach(async () => {
		await closeTypeOrm(store);
		store = undefined;
	});

	it("runs a read made while another request's transaction is open after that transaction, so it never sees its uncommitted rows", async () => {
		// Without the gate every one of these reads ran inside the open transaction and answered with a1,
		// a row that transaction then rolled back, so it was never stored.
		store = await openTypeOrm();
		const dataSource = store.dataSource;
		const held = holdOpen(dataSource.manager, 'a');
		await held.written;

		const reads = Promise.all([
			dataSource.getRepository(QueueRow).find({ order: { id: 'ASC' } }),
			dataSource.manager.count(QueueRow),
			dataSource.createQueryBuilder(QueueRow, 'row').getMany(),
			dataSource.query(`SELECT "id" FROM "queue_row"`)
		]);

		const waited = await stillPending(reads);
		held.letGo('fail');

		expect((await held.ended).error?.message).toBe('a fails');
		await expect(reads).resolves.toEqual([[], 0, [], []]);
		expect(waited).toBe(true);
		expect(store.log.statements).toEqual(['BEGIN TRANSACTION', 'INSERT a1', 'ROLLBACK']);
	});

	it("does not roll a write made while another request's transaction is open back with that transaction", async () => {
		// Without the gate every one of these writes ran inside the open transaction, reported success to
		// its caller, and was undone by that transaction's ROLLBACK.
		store = await openTypeOrm();
		const dataSource = store.dataSource;
		const repository = dataSource.getRepository(QueueRow);
		await repository.insert([
			{ id: 'u', tag: 'u' },
			{ id: 'd', tag: 'd' }
		]);
		store.log.clear();

		const held = holdOpen(dataSource.manager, 'a');
		await held.written;

		const writes = Promise.all([
			repository.insert({ id: 'c1', tag: 'c' }).then((result) => result.identifiers),
			repository.update({ id: 'u' }, { tag: 'updated' }).then((result) => result.affected),
			repository.delete({ id: 'd' }).then((result) => result.affected),
			dataSource
				.createQueryBuilder()
				.insert()
				.into(QueueRow)
				.values({ id: 'c2', tag: 'c' })
				.execute()
				.then(() => 'c2'),
			dataSource.query(`INSERT INTO "queue_row" ("id", "tag") VALUES (?, ?)`, ['c3', 'c']).then(() => 'c3')
		]);

		const waited = await stillPending(writes);
		held.letGo('fail');

		expect((await held.ended).error?.message).toBe('a fails');
		await expect(writes).resolves.toEqual([[{ id: 'c1' }], 1, 1, 'c2', 'c3']);
		expect(store.file.committedRows()).toEqual([
			{ id: 'c1', tag: 'c' },
			{ id: 'c2', tag: 'c' },
			{ id: 'c3', tag: 'c' },
			{ id: 'u', tag: 'updated' }
		]);
		expect(waited).toBe(true);
		// Every write reached the connection after the ROLLBACK, in whatever order its own path got there.
		expect(store.log.statements.slice(0, 3)).toEqual(['BEGIN TRANSACTION', 'INSERT a1', 'ROLLBACK']);
		expect([...store.log.statements.slice(3)].sort()).toEqual(['INSERT c1', 'INSERT c2', 'INSERT c3']);
	});

	it("runs a statement made while another request's transaction is open after that transaction commits, and sees what it stored", async () => {
		store = await openTypeOrm();
		const dataSource = store.dataSource;
		const held = holdOpen(dataSource.manager, 'a');
		await held.written;

		// The answer is the same either way; what differs is that it is the committed row, read once the
		// transaction is over, rather than the transaction's own uncommitted one.
		const read = dataSource.query(`SELECT "id" FROM "queue_row" ORDER BY "id"`);
		const waited = await stillPending(read);
		held.letGo('commit');

		expect((await held.ended).value).toBe('a');
		expect(idsOf(await read)).toEqual(['a1']);
		expect(waited).toBe(true);
		expect(store.log.statements).toEqual(['BEGIN TRANSACTION', 'INSERT a1', 'COMMIT']);
	});

	it('runs the statements of the transaction holding the connection inside it, however they reach the runner, while one from outside waits', async () => {
		// The holder's own statements go through the data source rather than the manager it was handed —
		// the same shared runner. They must not queue behind the statement waiting for the holder, which
		// would never end, and must stay inside the transaction: they read its uncommitted rows, a
		// transaction they open is still a savepoint of it, and they are rolled back with it.
		store = await openTypeOrm();
		const dataSource = store.dataSource;
		const repository = dataSource.getRepository(QueueRow);

		let written!: () => void;
		let proceed!: () => void;
		const hasWritten = new Promise<void>((resolve) => (written = resolve));
		const mayProceed = new Promise<void>((resolve) => (proceed = resolve));
		let seen: unknown[] = [];

		const holder = settle(
			dataSource.manager.transaction(async (manager) => {
				await manager.insert(QueueRow, { id: 'a1', tag: 'a' });
				written();
				await mayProceed;

				seen = await Promise.all([
					repository.find({ order: { id: 'ASC' } }).then(idsOf),
					dataSource.manager.count(QueueRow),
					dataSource.query(`SELECT "id" FROM "queue_row"`).then(idsOf)
				]);
				await dataSource.transaction((inner) => inner.insert(QueueRow, { id: 'a2', tag: 'a' }));
				await repository.insert({ id: 'a3', tag: 'a' });
				await dataSource.query(`INSERT INTO "queue_row" ("id", "tag") VALUES (?, ?)`, ['a4', 'a']);

				throw new Error('a fails');
			})
		);
		await hasWritten;

		const outside = repository.insert({ id: 'b1', tag: 'b' });
		await tick();
		proceed();

		expect((await holder).error?.message).toBe('a fails');
		await outside;
		expect(seen).toEqual([['a1'], 1, ['a1']]);
		expect(store.file.committed()).toEqual(['b1']);
		expect(store.log.statements).toEqual([
			'BEGIN TRANSACTION',
			'INSERT a1',
			'SAVEPOINT typeorm_1',
			'INSERT a2',
			'RELEASE SAVEPOINT typeorm_1',
			'INSERT a3',
			'INSERT a4',
			'ROLLBACK',
			'INSERT b1'
		]);
	});

	it('does the same for a transaction opened by hand on a query runner', async () => {
		// The claim of a transaction started by hand follows the code that started it, so the statements it
		// then runs through the data source — the same runner on SQLite — are its own.
		store = await openTypeOrm();
		const dataSource = store.dataSource;

		let written!: () => void;
		let proceed!: () => void;
		const hasWritten = new Promise<void>((resolve) => (written = resolve));
		const mayProceed = new Promise<void>((resolve) => (proceed = resolve));
		let seen: string[] = [];

		const byHand = async (): Promise<void> => {
			const runner = dataSource.createQueryRunner();
			await runner.connect();
			await runner.startTransaction();

			try {
				await runner.manager.insert(QueueRow, { id: 'h1', tag: 'h' });
				written();
				await mayProceed;

				seen = idsOf(await dataSource.query(`SELECT "id" FROM "queue_row" ORDER BY "id"`));
				await dataSource.manager.insert(QueueRow, { id: 'h2', tag: 'h' });
				await runner.commitTransaction();
			} catch (error) {
				await runner.rollbackTransaction();
				throw error;
			} finally {
				await runner.release();
			}
		};

		const holder = byHand();
		await hasWritten;

		const outside = dataSource.query(`SELECT "id" FROM "queue_row" ORDER BY "id"`);
		await tick();
		proceed();

		await holder;
		expect(seen).toEqual(['h1']);
		expect(idsOf(await outside)).toEqual(['h1', 'h2']);
		expect(store.log.statements).toEqual(['BEGIN TRANSACTION', 'INSERT h1', 'INSERT h2', 'COMMIT']);
	});

	it('gives up a statement that waited longer than it is allowed, without disturbing the transaction it waited for', async () => {
		store = await openTypeOrm({ waitTimeoutMs: 50 });
		const dataSource = store.dataSource;
		const held = holdOpen(dataSource.manager, 'a');
		await held.written;

		const read = await settle(dataSource.getRepository(QueueRow).find());

		expect(read.error).toBeInstanceOf(EmbeddedTransactionWaitTimeoutError);
		expect(read.error?.message).toMatch(/a statement waited 50 ms/);

		held.letGo('commit');
		expect((await held.ended).value).toBe('a');
		// The statement that gave up left the line: the next one runs at once, on a free connection.
		await expect(dataSource.manager.count(QueueRow)).resolves.toBe(1);
		expect(store.file.committed()).toEqual(['a1']);
		expect(store.log.statements).toEqual(['BEGIN TRANSACTION', 'INSERT a1', 'COMMIT']);
	});

	it('sends exactly what a data source without the queue sends, statement for statement, when nothing overlaps a transaction', async () => {
		// The gate decides when a statement runs, never what it is: the same work on a data source with the
		// queue and on one exactly as TypeORM builds it sends the same statements, with the same parameters,
		// in the same order, and answers the same.
		const workload = async (dataSource: DataSource): Promise<unknown[]> => {
			const repository = dataSource.getRepository(QueueRow);

			return [
				await repository.insert({ id: 'w1', tag: 'w' }).then((result) => result.identifiers),
				await repository.save({ id: 'w2', tag: 'w' }),
				await repository.find({ order: { id: 'ASC' } }),
				await repository.findOne({ where: { id: 'w1' } }),
				await repository.update({ id: 'w1' }, { tag: 'x' }).then((result) => result.affected),
				await Promise.all([
					repository.count(),
					dataSource.createQueryBuilder(QueueRow, 'row').where('row.tag = :tag', { tag: 'x' }).getMany(),
					dataSource.query(`SELECT count(*) AS "rows" FROM "queue_row"`)
				]),
				await dataSource.transaction(async (manager) => {
					await manager.insert(QueueRow, { id: 'w3', tag: 'w' });
					return manager.transaction((inner) => inner.delete(QueueRow, { id: 'w2' }).then((r) => r.affected));
				}),
				await repository.delete({ id: 'w1' }).then((result) => result.affected),
				await repository.find({ order: { id: 'ASC' } })
			];
		};

		store = await openTypeOrm();
		const bare = await openTypeOrm(undefined, false);

		try {
			expect(hasEmbeddedTransactionQueue(bare.dataSource)).toBe(false);

			const queued = await workload(store.dataSource);
			const unqueued = await workload(bare.dataSource);

			expect(queued).toEqual(unqueued);
			expect(store.log.everything.length).toBeGreaterThan(10);
			expect(store.log.everything).toEqual(bare.log.everything);
		} finally {
			await closeTypeOrm(bare);
		}
	});
});

describe('serializeEmbeddedTransactions — the dialects it leaves alone', () => {
	it.each([
		['postgres', { type: 'postgres', host: 'localhost' }],
		['mysql', { type: 'mysql', host: 'localhost' }]
	] as Array<[string, DataSourceOptions]>)(
		'returns a %s data source exactly as TypeORM built it',
		(_label, options) => {
			// Their drivers give each runner its own pooled connection, and the database isolates the
			// transactions; nothing here may wrap, replace or even look at a runner of theirs.
			const dataSource = new DataSource(options);
			const own = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

			expect(serializeEmbeddedTransactions(dataSource)).toBe(dataSource);
			expect(hasEmbeddedTransactionQueue(dataSource)).toBe(false);
			expect(own(dataSource.manager, 'transaction')).toBe(false);
			expect(own(dataSource, 'createEntityManager')).toBe(false);
			expect(own(dataSource.driver, 'createQueryRunner')).toBe(false);

			// Nor any runner it hands out: every statement, transaction and bookkeeping read is TypeORM's own.
			const runner = dataSource.createQueryRunner();
			for (const member of ['query', 'startTransaction', 'commitTransaction', 'rollbackTransaction']) {
				expect(own(runner, member)).toBe(false);
			}
			expect(Object.getOwnPropertyDescriptor(runner, 'isTransactionActive')?.get).toBeUndefined();
		}
	);
});

describe('the DatabaseModule data source', () => {
	/**
	 * The factory the module's TypeORM connection is built with, read from the module's own metadata
	 * rather than restated here, so a module that stopped using it would fail this.
	 */
	function dataSourceProviderFactory(): (options: DataSourceOptions) => Promise<DataSource> {
		type Provider = { provide?: unknown; useFactory?: (options: DataSourceOptions) => Promise<DataSource> };
		type DynamicModule = { module?: unknown; imports?: Array<{ providers?: Provider[] }> };

		const imports: DynamicModule[] = Reflect.getMetadata('imports', DatabaseModule);
		const typeOrm = imports.find((entry) => entry?.module === TypeOrmModule);
		const provider = typeOrm?.imports?.[0]?.providers?.find((candidate) => candidate?.provide === DataSource);

		return provider.useFactory;
	}

	it('queues the transactions of the SQLite data source it provides', async () => {
		const file = new DatabaseFile();
		const log = new StatementLog();
		const dataSource = await dataSourceProviderFactory()(typeOrmOptions(file, log));
		const store = { dataSource, file, log };

		try {
			log.clear();

			expect(dataSource.isInitialized).toBe(true);
			expect(hasEmbeddedTransactionQueue(dataSource)).toBe(true);
			await expect(Promise.all([writeTwo(dataSource, 'a'), writeTwo(dataSource, 'b')])).resolves.toEqual([
				'a',
				'b'
			]);
			expect(file.committed()).toEqual(['a1', 'a2', 'b1', 'b2']);
		} finally {
			await closeTypeOrm(store);
		}
	});

	it('leaves the data source it provides for PostgreSQL untouched', async () => {
		const dataSource = await dataSourceProviderFactory()({
			type: 'postgres',
			host: 'localhost',
			manualInitialization: true
		} as DataSourceOptions);

		expect(dataSource.isInitialized).toBe(false);
		expect(hasEmbeddedTransactionQueue(dataSource)).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(dataSource.manager, 'transaction')).toBe(false);
	});
});

/**
 * The same three properties under MikroORM, which needs no queue of its own: knex gives SQLite a pool of
 * exactly one connection, so a second transaction waits for the pool rather than sharing the first
 * one's. These hold the platform to that — a change that let MikroORM share the connection would fail
 * here just as TypeORM did.
 */
describe('MikroORM on better-sqlite — transactions are already one at a time', () => {
	let orm: MikroORM | undefined;
	let file: DatabaseFile | undefined;
	const statements: string[] = [];

	beforeEach(async () => {
		file = new DatabaseFile();
		orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: file.path,
			entities: [MikroOrmQueueRow],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false },
			debug: ['query'],
			logger: (message: string) => {
				// eslint-disable-next-line no-control-regex
				const statement = message.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\[query\] /, '');

				if (/^(begin|commit|rollback|savepoint|release)/.test(statement)) {
					statements.push(statement.replace(/ \[took .*$/, ''));
				}
			}
		});
		await orm.getSchemaGenerator().createSchema();
		statements.length = 0;
	});

	afterEach(async () => {
		await orm?.close(true);
		file?.remove();
		orm = undefined;
		file = undefined;
	});

	/** The value a `beforeEach` opened, which every test below runs after. */
	function opened<T>(value: T | undefined): T {
		if (value === undefined) {
			throw new Error('The MikroORM store was not opened.');
		}

		return value;
	}

	/** The MikroORM form of {@link writeTwo}. */
	const writeTwoWithMikroOrm = (tag: string, fail = false): Promise<string> =>
		opened(orm)
			.em.fork()
			.transactional(async (em) => {
				await em.insert(MikroQueueRow, { id: `${tag}1`, tag });
				await tick();
				await em.insert(MikroQueueRow, { id: `${tag}2`, tag });
				await tick();

				if (fail) {
					throw new Error(`${tag} fails`);
				}

				return tag;
			});

	it('lets two transactions opened in the same tick each commit their own rows', async () => {
		await expect(Promise.all([writeTwoWithMikroOrm('a'), writeTwoWithMikroOrm('b')])).resolves.toEqual(['a', 'b']);
		expect(opened(file).committed()).toEqual(['a1', 'a2', 'b1', 'b2']);
		expect(statements).toEqual(['begin', 'commit', 'begin', 'commit']);
	});

	it('rolls back only the failing one of two transactions opened in the same tick', async () => {
		const [first, second] = await Promise.all([
			settle(writeTwoWithMikroOrm('a', true)),
			settle(writeTwoWithMikroOrm('b'))
		]);

		expect(first.error?.message).toBe('a fails');
		expect(second.value).toBe('b');
		expect(opened(file).committed()).toEqual(['b1', 'b2']);
	});

	it('keeps a transaction opened inside another a savepoint of it', async () => {
		const outer = await opened(orm)
			.em.fork()
			.transactional(async (em) => {
				await em.insert(MikroQueueRow, { id: 'o1', tag: 'o' });
				const failedInner = await settle(
					em.transactional(async (inner) => {
						await inner.insert(MikroQueueRow, { id: 'i1', tag: 'i' });
						throw new Error('inner fails');
					})
				);
				await em.transactional((inner) => inner.insert(MikroQueueRow, { id: 'i2', tag: 'i' }));

				return failedInner.error?.message;
			});

		expect(outer).toBe('inner fails');
		expect(opened(file).committed()).toEqual(['i2', 'o1']);
		expect(statements.filter((statement) => statement.startsWith('savepoint'))).toHaveLength(2);
	});

	it('runs a statement made while a transaction is open after it, so it neither sees nor is rolled back with it', async () => {
		// The contract the TypeORM gate gives its statements: a fork outside the transaction waits for the
		// pool's one connection, and so for the transaction holding it.
		let written!: () => void;
		let letFail!: () => void;
		const hasWritten = new Promise<void>((resolve) => (written = resolve));
		const mayFail = new Promise<void>((resolve) => (letFail = resolve));

		const holder = settle(
			opened(orm)
				.em.fork()
				.transactional(async (em) => {
					await em.insert(MikroQueueRow, { id: 'a1', tag: 'a' });
					written();
					await mayFail;
					throw new Error('a fails');
				})
		);
		await hasWritten;

		const outside = Promise.all([
			opened(orm)
				.em.fork()
				.find(MikroQueueRow, {}, { orderBy: { id: 'asc' } })
				.then((rows) => rows.map((row) => row.id)),
			opened(orm).em.fork().insert(MikroQueueRow, { id: 'c1', tag: 'c' })
		]);

		expect(await stillPending(outside)).toBe(true);
		letFail();

		expect((await holder).error?.message).toBe('a fails');
		// Whichever of the two the pool serves first, the read never sees the rolled-back row.
		expect((await outside)[0]).not.toContain('a1');
		expect(opened(file).committed()).toEqual(['c1']);
	});
});
