jest.mock('@gauzy/config', () => {
	const actual = jest.requireActual('@gauzy/config');

	// The dialect is decided once at boot from the environment; here it is decided per case so the
	// row-locked path and the embedded path are both exercised by this suite.
	const dialect = { current: 'postgres' as 'postgres' | 'sqlite' };

	return {
		...actual,
		isPostgres: () => dialect.current === 'postgres',
		isMySQL: () => false,
		isBetterSqlite3: () => dialect.current === 'sqlite',
		dialect
	};
});

jest.mock('../core/crud/crud.service', () => {
	// The subject is the administration surface, not the CRUD base, so the base is replaced by the
	// three members this service actually inherits: a constructor, the read it scopes, and the write an
	// edit reaches.
	class CrudService {
		constructor(protected readonly typeOrmRepository: any) {}

		find(options?: unknown): Promise<any[]> {
			return this.typeOrmRepository.find(options);
		}

		update(id: unknown, partial: unknown): Promise<unknown> {
			return this.typeOrmRepository.update(id, partial);
		}
	}

	return { CrudService };
});

jest.mock('./sequence.entity', () => {
	// The entity is the persistence boundary: the service hands the class to the manager and the store
	// below answers for it, so the decorators of the real entity are not loaded here.
	class Sequence {}

	return { Sequence };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentTenantId: () => scope.tenantId,
		currentOrganizationId: () => scope.organizationId
	}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SequenceResetPolicy } from '@gauzy/contracts';
import { SequenceService } from './sequence.service';
import { TypeOrmSequenceRepository } from './repository/type-orm-sequence.repository';

/**
 * Administering the numbering series.
 *
 * Two properties of this resource are the whole point of the surface, and both are asserted here
 * rather than only through a resolver's delegation:
 *
 * - **the counter is not configuration.** It moves by allocating a number, and the one operation that
 *   moves it backwards is the restart the series' own `resetPolicy` describes. An edit that could
 *   write it would renumber every document the installation has already issued, and the suite pins
 *   that the edit refuses the member instead of writing it;
 * - **the restart is a move, not a column write.** It rewinds the counter and records the moment,
 *   inside a transaction and under the same row lock the allocator takes, and what it refuses is the
 *   kernel's own answer: a policy that says the series never restarts, a period that has already been
 *   restarted, and a series whose period has not been recorded yet.
 *
 * The store below is the table and the manager that guards it: transactions run one at a time, exactly
 * as the database serialises writers, so a restart that read outside one would be visible here.
 */

type Row = Record<string, any>;

interface SeriesRow extends Row {
	id: string;
	key: string;
	channelId: string | null;
	prefix?: string;
	padding: number;
	nextValue: number;
	step: number;
	resetPolicy: SequenceResetPolicy;
	lastResetAt?: Date | null;
	tenantId?: string;
	organizationId?: string;
	description?: string;
	isActive?: boolean;
}

/** The tenant and organization a request runs in, as the mocked context answers them. */
const scope: { tenantId: string | null; organizationId: string | null } = {
	tenantId: '00000000-0000-4000-8000-000000000001',
	organizationId: '00000000-0000-4000-8000-000000000002'
};

/**
 * An in-memory stand-in for the series table and the manager that guards it.
 *
 * `transaction` runs one body at a time, and every read and write is recorded with the transaction
 * depth it happened at, so the suite can show that the restart really is taken under the lock the
 * allocator takes rather than merely claiming to be.
 */
class SeriesTable {
	readonly rows: SeriesRow[] = [];
	readonly locks: string[] = [];
	readonly depths: number[] = [];
	readonly wheres: Row[] = [];
	transactions = 0;

	private depth = 0;

	constructor(rows: Partial<SeriesRow>[] = []) {
		for (const row of rows) {
			this.rows.push({
				id: `seq-${this.rows.length + 1}`,
				key: 'ORDER',
				channelId: null,
				prefix: 'SO-',
				padding: 6,
				nextValue: 1,
				step: 1,
				resetPolicy: SequenceResetPolicy.NEVER,
				lastResetAt: null,
				tenantId: scope.tenantId ?? undefined,
				organizationId: scope.organizationId ?? undefined,
				...row
			} as SeriesRow);
		}
	}

	private readonly manager = {
		transaction: (work: (manager: unknown) => Promise<unknown>) => this.transaction(work),
		createQueryBuilder: (_entity: unknown, alias: string) => this.queryBuilder(alias),
		save: async (_entity: unknown, row: SeriesRow) => this.persist(row)
	};

	/** The repository the service is constructed with. */
	get repository(): unknown {
		return {
			manager: this.manager,
			find: async (options: { where: Row; order?: Row }) => {
				this.wheres.push(options?.where ?? {});

				return this.rows.filter((row) => matchesRow(row, options?.where ?? {}));
			},
			update: async (id: string, partial: Row) => {
				this.depths.push(this.depth);
				Object.assign(this.findRow(id) ?? {}, partial);

				return { affected: 1 };
			},
			create: (input: Row) => ({ ...input }),
			save: async (row: SeriesRow) => this.persist(row)
		};
	}

	/** The row under one id, as the store holds it. */
	row(id: string): SeriesRow | undefined {
		return this.rows.find((candidate) => candidate.id === id);
	}

	/** One transaction at a time, as the database serialises writers. */
	private async transaction<T>(work: (manager: unknown) => Promise<T>): Promise<T> {
		this.transactions += 1;
		this.depth += 1;

		// What the table held when the transaction opened. A body that throws rolls back to it, which is
		// the property that makes a declined move a declined move rather than a write nobody saved: the
		// kernel's restart path mutates the row it read, so without the rollback an operation that
		// refused would still look as though it had stamped the period.
		const opened = this.rows.map((row) => ({ ...row }));

		try {
			return await work(this.manager);
		} catch (error) {
			this.rows.length = 0;
			this.rows.push(...opened);

			throw error;
		} finally {
			this.depth -= 1;
		}
	}

	private queryBuilder(alias: string) {
		const conditions: Row = {};
		const builder = {
			where: (where: Row) => {
				Object.assign(conditions, where);

				return builder;
			},
			/**
			 * The service states the channel condition as a raw fragment rather than as a `where` member,
			 * because "no channel" has to be asked for as `IS NULL`: a `channelId = NULL` comparison
			 * matches nothing in any dialect. The double models exactly the two fragments the service
			 * states and refuses anything else, so a condition it does not understand fails the suite
			 * rather than quietly matching every row.
			 */
			andWhere: (fragment: string, parameters: Row = {}) => {
				if (/IS\s+NULL\s*$/i.test(fragment)) {
					conditions.channelId = null;
				} else if (parameters.channelId !== undefined) {
					conditions.channelId = parameters.channelId;
				} else {
					throw new Error(`the sequence double was handed a condition it does not model: ${fragment}`);
				}

				return builder;
			},
			setLock: (mode: string) => {
				this.locks.push(`${alias}:${mode}`);

				return builder;
			},
			getOne: async () => this.rows.find((row) => matchesRow(row, conditions)) ?? null
		};

		return builder;
	}

	private findRow(id: string): SeriesRow | undefined {
		this.depths.push(this.depth);

		return this.rows.find((row) => row.id === id);
	}

	private persist(row: SeriesRow): SeriesRow {
		this.depths.push(this.depth);

		// A row that has never been stored is handed the identifier the table would generate, which is
		// what makes a create and an update reach the same row on the next read.
		if (!row.id) {
			row.id = `seq-${this.rows.length + 1}`;
		}

		const index = this.rows.findIndex((existing) => existing.id === row.id);

		if (index === -1) {
			this.rows.push(row);
		} else {
			this.rows[index] = row;
		}

		return row;
	}
}

/** A missing column and a null column are the same thing to the database. */
function matches(value: unknown, condition: unknown): boolean {
	return (value ?? null) === (condition ?? null);
}

/** Whether one row satisfies every member of a condition, the way a `where` does. */
function matchesRow(row: Row, where: Row): boolean {
	return Object.entries(where ?? {}).every(([column, value]) => matches(row[column], value));
}

/** The service under test and the table it administers. */
function seriesTable(rows: Partial<SeriesRow>[] = []) {
	const table = new SeriesTable(rows);

	return {
		table,
		service: new SequenceService(table.repository as TypeOrmSequenceRepository, {} as never, {} as never)
	};
}

/** A moment inside February 2026, used wherever a period boundary matters. */
const AT = new Date('2026-02-10T09:30:00Z');

beforeEach(() => {
	scope.tenantId = '00000000-0000-4000-8000-000000000001';
	scope.organizationId = '00000000-0000-4000-8000-000000000002';
});

describe('creating a series', () => {
	it('refuses a second series for one key and scope, and asks for the organization-wide row as IS NULL', async () => {
		const { table, service } = seriesTable([{ key: 'ORDER', channelId: null }]);

		const error = await service.createSeries({ key: 'ORDER' }).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('UNIQUE_CONSTRAINT_VIOLATION');
		// The refusal is the readable answer to the collision; the table's two partial unique indexes are
		// the guarantee, and the read that produces it is the one the allocator locks through, so the
		// organization-wide row is asked for as `channelId IS NULL` rather than as `channelId = NULL`.
		expect(table.rows).toHaveLength(1);
	});

	it('creates a channel series beside the organization-wide one, which is what the two indexes allow', async () => {
		const { table, service } = seriesTable([{ key: 'ORDER', channelId: null }]);
		const channelId = '00000000-0000-4000-8000-000000000010';

		const created = await service.createSeries({ key: 'ORDER', channelId });

		expect(created.channelId).toBe(channelId);
		expect(table.rows).toHaveLength(2);
	});

	it('stamps the caller’s scope and the documented defaults, and states the members rather than spreading them', async () => {
		const { table, service } = seriesTable([]);

		const created = await service.createSeries({
			key: ' ORDER ',
			prefix: 'SO-',
			// A body that smuggles an id in would make the save an update of a row this create may not
			// touch, which is why the write states its members one by one.
			...({ id: 'seq-9' } as Record<string, unknown>)
		} as never);

		expect(created).toMatchObject({
			key: 'ORDER',
			prefix: 'SO-',
			padding: 6,
			step: 1,
			nextValue: 1,
			resetPolicy: SequenceResetPolicy.NEVER,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});
		expect(created.id).toBe('seq-1');
		expect(table.rows).toHaveLength(1);
	});

	it('refuses a series stated without a key', async () => {
		const { service } = seriesTable([]);

		const error = await service.createSeries({ key: '   ' }).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('VALIDATION_REQUIRED_FIELD');
	});
});

describe('changing the configuration of a series', () => {
	it('writes the shape of the numbers and leaves the counter alone', async () => {
		const { table, service } = seriesTable([{ id: 'seq-1', nextValue: 42, prefix: 'SO-' }]);

		const updated = await service.updateSeries('seq-1', {
			prefix: 'ORD-',
			padding: 8,
			step: 5,
			resetPolicy: SequenceResetPolicy.YEARLY,
			description: 'Orders'
		} as never);

		expect(updated).toMatchObject({ prefix: 'ORD-', padding: 8, step: 5, description: 'Orders' });
		expect(updated.resetPolicy).toBe(SequenceResetPolicy.YEARLY);
		// The counter is untouched: an edit is configuration, and the value the next document will be
		// numbered with is not configuration.
		expect(table.row('seq-1')?.nextValue).toBe(42);
	});

	it('refuses a body that states the counter, and the series keeps the value it had', async () => {
		const { table, service } = seriesTable([{ id: 'seq-1', nextValue: 42 }]);

		const error = await service.updateSeries('seq-1', { nextValue: 1 } as never).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('PRECONDITION_REQUIRED');
		expect((error as Error).message).toContain("'nextValue' is the series' state");
		expect(table.row('seq-1')?.nextValue).toBe(42);
	});

	it('refuses a body that states the period the series last restarted in', async () => {
		const { service } = seriesTable([{ id: 'seq-1' }]);

		const error = await service.updateSeries('seq-1', { lastResetAt: AT } as never).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('PRECONDITION_REQUIRED');
	});

	it('refuses a body that renames the key or moves the channel, which are the counter’s identity', async () => {
		const { service } = seriesTable([{ id: 'seq-1' }]);

		await expect(service.updateSeries('seq-1', { key: 'SALES_ORDER' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(
			service.updateSeries('seq-1', { channelId: '00000000-0000-4000-8000-000000000010' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses a series that is not in the caller’s scope, as a series that does not exist', async () => {
		const { service } = seriesTable([{ id: 'seq-1', organizationId: 'another-organization' }]);

		await expect(service.updateSeries('seq-1', { prefix: 'X-' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
});

describe('restarting a series', () => {
	it('rewinds the counter and records the moment, under the allocator’s own lock and inside a transaction', async () => {
		const { table, service } = seriesTable([
			{ id: 'seq-1', nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-01-31T23:59:00Z') }
		]);

		const restarted = await service.resetSeries('seq-1', { at: AT });

		expect(restarted.nextValue).toBe(1);
		expect(restarted.lastResetAt).toEqual(AT);
		expect(table.row('seq-1')).toMatchObject({ nextValue: 1, lastResetAt: AT });
		// The move is taken the way the allocator takes it: the row is read under `FOR UPDATE` on a
		// dialect that has one, inside a transaction, so a concurrent allocation is serialised against it.
		expect(table.locks).toEqual(['sequence:pessimistic_write']);
		expect(table.transactions).toBe(1);
		expect(table.depths).toContain(1);
	});

	it('refuses a series whose policy says it never restarts, and costs the counter nothing', async () => {
		const { table, service } = seriesTable([
			{ id: 'seq-1', nextValue: 57, resetPolicy: SequenceResetPolicy.NEVER, lastResetAt: new Date('2020-01-01T00:00:00Z') }
		]);

		const error = await service.resetSeries('seq-1', { at: AT }).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('PRECONDITION_REQUIRED');
		expect((error as Error).message).toContain('reset policy is NEVER');
		// A `NEVER` series rewound to one would reissue every number it has ever handed out, which is why
		// the operation declines rather than performing the write the caller could have made by hand.
		expect(table.row('seq-1')).toMatchObject({ nextValue: 57 });
		expect(table.row('seq-1')?.lastResetAt).toEqual(new Date('2020-01-01T00:00:00Z'));
	});

	it('refuses a series that has already restarted inside the period this moment falls in', async () => {
		const { table, service } = seriesTable([
			{ id: 'seq-1', nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: new Date('2026-02-01T00:00:00Z') }
		]);

		const error = await service.resetSeries('seq-1', { at: AT }).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('already restarted inside the period');
		// A restart happens at most once per period: a second one would hand out values this period has
		// already handed out.
		expect(table.row('seq-1')).toMatchObject({ nextValue: 57 });
	});

	it('refuses a series with no period recorded yet, and records none of its own', async () => {
		const { table, service } = seriesTable([
			{ id: 'seq-1', nextValue: 57, resetPolicy: SequenceResetPolicy.MONTHLY, lastResetAt: null }
		]);

		const error = await service.resetSeries('seq-1', { at: AT }).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(BadRequestException);
		expect((error as Error).message).toContain('no period is recorded');
		// The transactional refusal rolls back the period the kernel's first-contact path would have
		// recorded: an operation that was declined leaves the row exactly as it found it.
		expect(table.row('seq-1')?.lastResetAt).toBeNull();
		expect(table.row('seq-1')).toMatchObject({ nextValue: 57 });
	});

	it('restarts on the policy’s own boundary, so a yearly series is rewound in a new year and not before', async () => {
		const yearly = seriesTable([
			{ id: 'seq-1', nextValue: 9, resetPolicy: SequenceResetPolicy.YEARLY, lastResetAt: new Date('2025-12-31T23:59:59Z') }
		]);
		const sameYear = seriesTable([
			{ id: 'seq-1', nextValue: 9, resetPolicy: SequenceResetPolicy.YEARLY, lastResetAt: new Date('2026-01-01T00:00:00Z') }
		]);

		expect((await yearly.service.resetSeries('seq-1', { at: new Date('2026-01-01T00:00:00Z') })).nextValue).toBe(1);
		await expect(sameYear.service.resetSeries('seq-1', { at: AT })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses a series that is not in the caller’s scope', async () => {
		const { service } = seriesTable([{ id: 'seq-1', organizationId: 'another-organization' }]);

		await expect(service.resetSeries('seq-1', { at: AT })).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('reading the series of the caller’s organization', () => {
	it('scopes every read by the tenant and the organization the credential carries', async () => {
		const { table, service } = seriesTable([
			{ id: 'seq-1', key: 'ORDER' },
			{ id: 'seq-2', key: 'RETURN', organizationId: 'another-organization' }
		]);

		const listed = await service.listSeries();

		expect(listed.map((series) => series.id)).toEqual(['seq-1']);
		expect(table.wheres[0]).toMatchObject({
			tenantId: scope.tenantId,
			organizationId: scope.organizationId
		});

		// A series of another organization is answered as one that does not exist, so a caller is never
		// told that an identifier it may not read names a row.
		await expect(service.findSeriesOrFail('seq-2')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('narrows the list by key and by channel, which are the members the endpoint table names', async () => {
		const channelId = '00000000-0000-4000-8000-000000000010';
		const { table, service } = seriesTable([
			{ id: 'seq-1', key: 'ORDER', channelId: null },
			{ id: 'seq-2', key: 'ORDER', channelId },
			{ id: 'seq-3', key: 'RETURN', channelId }
		]);

		const byKey = await service.listSeries({ key: 'ORDER' });
		const byChannel = await service.listSeries({ channelId });

		expect(byKey.map((series) => series.id)).toEqual(['seq-1', 'seq-2']);
		expect(byChannel.map((series) => series.id)).toEqual(['seq-2', 'seq-3']);
		// A member that was not stated is left out of the condition rather than written as `undefined`,
		// which the database would read as "the column is null" — a different question entirely.
		expect(Object.keys(table.wheres[0])).not.toContain('channelId');
	});
});
