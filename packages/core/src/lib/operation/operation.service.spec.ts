import { ConflictException } from '@nestjs/common';
import { RequestContext } from '../core/context/request-context';
import { IOperationDefinition, IOperationStepDefinition, IStepRetryPolicy } from './operation.contract';
import { Operation } from './operation.entity';
import { OperationStep } from './operation-step.entity';
import { OperationRegistry, OperationTypeUnknownError } from './operation.registry';
import { OperationService } from './operation.service';
import { TypeOrmOperationRepository } from './repository/type-orm-operation.repository';
import { TypeOrmOperationStepRepository } from './repository/type-orm-operation-step.repository';

/**
 * The durable-operation runtime, against tables that behave like the tables they stand in for.
 *
 * A durable operation is a plan, its progress and its undo, and each of the three is a case here:
 * the steps run in order and each outcome is persisted before the next one starts, so a restart
 * resumes rather than restarts; a failure walks the *completed* steps backwards and runs their
 * compensators in reverse, never pretending the aggregate is clean when one of them gave up; and a
 * deadline abandons the unfinished operation and compensates what it did rather than leaving it on
 * the aggregate forever. Only one worker drives an operation at a time, and a step that is invoked
 * again — under retry, or after a crash — is invoked under the same stable idempotency key.
 *
 * The clock is pinned and injected, so a lease expiring and a deadline passing are asserted rather
 * than waited for.
 */

type Row = Record<string, any>;

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
}

/** One column's criteria, including the `IN (:...values)` form the aggregate query builds. */
function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => {
		const operator = condition as { _type?: string; _value?: unknown[] };

		if (operator && typeof operator === 'object' && operator._type === 'in' && Array.isArray(operator._value)) {
			return operator._value.includes(row[column]);
		}

		return (row[column] ?? null) === (condition ?? null);
	});
}

/** An in-memory stand-in for one table: the criteria, the ordering and the unique tuple it applies. */
class Table {
	readonly rows: Row[] = [];
	private sequence = 0;

	constructor(private readonly uniqueKey?: (row: Row) => string | undefined) {}

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `row-${this.sequence}`, ...input };
	}

	async save(rows: Row | Row[]): Promise<any> {
		for (const row of Array.isArray(rows) ? rows : [rows]) {
			const key = this.uniqueKey?.(row);
			const clash =
				key === undefined ? undefined : this.rows.find((entry) => entry.id !== row.id && this.uniqueKey?.(entry) === key);

			if (clash) {
				throw uniqueViolation();
			}

			const existing = this.rows.findIndex((entry) => entry.id === row.id);

			if (existing === -1) {
				this.rows.push(row);
			} else {
				this.rows[existing] = row;
			}
		}

		return rows;
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => matches(row, options.where ?? {})) ?? null;
	}

	async find(options: { where?: Row; order?: Row } = {}): Promise<Row[]> {
		return this.rows.filter((row) => matches(row, options.where ?? {})).sort(byOrder(options.order));
	}

	createQueryBuilder(alias: string) {
		const conditions: { clause?: string; criteria?: Row; params: Row }[] = [];

		const filtered = () =>
			this.rows.filter((row) =>
				conditions.every(({ clause, criteria, params }) =>
					clause === undefined ? matches(row, criteria ?? {}) : evaluate(row, clause, params)
				)
			);

		const builder = {
			where: (clauseOrCriteria: string | Row, params: Row = {}) => {
				conditions.push(
					typeof clauseOrCriteria === 'string'
						? { clause: clauseOrCriteria, params }
						: { criteria: clauseOrCriteria, params }
				);

				return builder;
			},
			andWhere: (clauseOrCriteria: string | Row, params: Row = {}) => {
				conditions.push(
					typeof clauseOrCriteria === 'string'
						? { clause: clauseOrCriteria, params }
						: { criteria: clauseOrCriteria, params }
				);

				return builder;
			},
			orderBy: (_column: string, _direction: string) => builder,
			addOrderBy: (_column: string, _direction: string) => builder,
			take: (_count: number) => builder,
			setLock: (_mode: string) => builder,
			getOne: async () => filtered()[0] ?? null,
			getMany: async () => filtered()
		};

		return builder;
	}
}

/**
 * Reads the clauses the service builds: `alias.column <op> :param`, `alias.column IN (:...param)`, and the
 * nullity test the sweep states.
 *
 * The nullity form names its column in quotes — `operation."leaseExpiresAt" IS NOT NULL` — because the
 * column is camelCase and a bare identifier would be folded to lower case by the dialect. The double reads
 * the shape the service actually writes rather than the service being written around the double.
 */
function evaluate(row: Row, clause: string, params: Row): boolean {
	const inClause = /(\w+)\.(\w+)\s+IN\s*\(:\.\.\.(\w+)\)/.exec(clause);

	if (inClause) {
		const [, , column, parameter] = inClause;

		return (params[parameter] as unknown[]).includes(row[column]);
	}

	const nullity = /(\w+)\."?(\w+)"?\s+IS\s+(NOT\s+)?NULL/i.exec(clause);

	if (nullity) {
		const [, , column, negated] = nullity;
		const isNull = row[column] === null || row[column] === undefined;

		return negated ? !isNull : isNull;
	}

	const parsed = /(\w+)\."?(\w+)"?\s*(<=|>=|<>|=|<|>)\s*:(\w+)/.exec(clause);

	if (!parsed) {
		throw new Error(`The in-memory query builder cannot read the clause "${clause}".`);
	}

	const [, , column, operator, parameter] = parsed;
	const left = instant(row[column]);
	const right = instant(params[parameter]);

	switch (operator) {
		case '=':
			return left === right;
		case '<>':
			return left !== right;
		case '<=':
			return left <= right;
		case '>=':
			return left >= right;
		case '<':
			return left < right;
		default:
			return left > right;
	}
}

function instant(value: unknown): any {
	return value instanceof Date ? value.getTime() : value;
}

function byOrder(order: Row = {}): (left: Row, right: Row) => number {
	const columns = Object.keys(order);

	return (left, right) => {
		for (const column of columns) {
			if (left[column] === right[column]) {
				continue;
			}

			return (left[column] > right[column] ? 1 : -1) * (order[column] === 'DESC' ? -1 : 1);
		}

		return 0;
	};
}

/** The tables one service writes to, plus the manager that rolls them back together. */
class Database {
	readonly tables = new Map<unknown, Table>();
	readonly transactions: number[] = [];

	constructor(private readonly uniqueKeys: Map<unknown, (row: Row) => string | undefined> = new Map()) {}

	tableOf(entity: unknown): Table {
		let table = this.tables.get(entity);

		if (!table) {
			table = new Table(this.uniqueKeys.get(entity));
			this.tables.set(entity, table);
		}

		return table;
	}

	async transaction<R>(work: (manager: any) => Promise<R>): Promise<R> {
		const before = new Map(
			[...this.tables.entries()].map(([entity, table]) => [entity, table.rows.map((row) => ({ ...row }))])
		);

		try {
			const result = await work(this.manager);

			this.transactions.push(this.tables.size);

			return result;
		} catch (error) {
			for (const [entity, table] of this.tables) {
				table.rows.splice(0, table.rows.length, ...(before.get(entity) ?? []));
			}

			throw error;
		}
	}

	readonly manager = {
		transaction: <R>(work: (manager: any) => Promise<R>): Promise<R> => this.transaction(work),
		create: (entity: unknown, input: Row) => this.tableOf(entity).create(input),
		save: (entity: unknown, rows: Row | Row[]) => this.tableOf(entity).save(rows),
		createQueryBuilder: (entity: unknown, alias: string) => this.tableOf(entity).createQueryBuilder(alias)
	};
}

/** A repository stand-in: the table it owns, plus the shared manager. */
function repositoryFor(table: Table, db: Database) {
	return {
		create: (input: Row) => table.create(input),
		save: (rows: Row | Row[]) => table.save(rows),
		findOne: (options: { where?: Row }) => table.findOne(options),
		find: (options: { where?: Row; order?: Row }) => table.find(options),
		createQueryBuilder: (alias: string) => table.createQueryBuilder(alias),
		manager: db.manager
	};
}

const T0 = new Date('2026-03-01T10:00:00Z');
const CART = '6b1e0f2a-0000-4000-8000-000000000001';
const TYPE = 'CHECKOUT_COMPLETE';

/** What the handlers of a plan did, so a case can assert on the order they ran in. */
interface Trace {
	invoked: string[];
	compensated: string[];
	keys: string[];
	inputs: Row[];
}

/** What the service announced, so a case can assert on the facts it produced. */
interface Announcements {
	stepChanged: jest.Mock;
	completed: jest.Mock;
	failed: jest.Mock;
}

/** The harness: the service, the tables it writes to, and the trace its handlers leave. */
function runtime() {
	const db = new Database(
		new Map<unknown, (row: Row) => string | undefined>([
			// `idempotencyKey` is unique per organization and type *when it is set*, and the live
			// aggregate rule is a partial index too: an operation that names neither is unconstrained.
			[Operation, (row) => (row.idempotencyKey ? `${row.organizationId}:${row.type}:${row.idempotencyKey}` : undefined)],
			[OperationStep, (row) => `${row.operationId}:${row.name}`]
		])
	);

	const trace: Trace = { invoked: [], compensated: [], keys: [], inputs: [] };
	const registry = new OperationRegistry();

	// The publisher the service announces through. It is scripted rather than mocked away, so a case
	// can assert which facts a pass produced and in which order — the announcements are made by the
	// service, and a suite that could not see them would not be covering the producers at all.
	const announcements: Announcements = {
		stepChanged: jest.fn().mockResolvedValue(true),
		completed: jest.fn().mockResolvedValue(true),
		failed: jest.fn().mockResolvedValue(true)
	};

	const publisher = {
		operationStepChanged: announcements.stepChanged,
		operationCompleted: announcements.completed,
		operationFailed: announcements.failed
	};

	const service = new OperationService(
		repositoryFor(db.tableOf(Operation), db) as unknown as TypeOrmOperationRepository,
		{} as never,
		repositoryFor(db.tableOf(OperationStep), db) as unknown as TypeOrmOperationStepRepository,
		{} as never,
		registry,
		publisher as never
	);

	/** A plan over the named steps, with one step failing and one compensator giving up. */
	const define = (
		names: string[],
		options: {
			failsAt?: string;
			noCompensator?: string;
			compensateFailsAt?: string;
			retry?: IStepRetryPolicy;
			failFirstAttemptAt?: string;
		} = {}
	): IOperationDefinition => {
		let attempts = 0;

		return {
			steps: names.map(
				(name, index): IOperationStepDefinition => ({
					name,
					order: index + 1,
					retry: options.retry,
					async invoke(input, context) {
						attempts += 1;
						trace.invoked.push(name);
						trace.keys.push(context.idempotencyKey);
						trace.inputs.push(input as Row);

						if (options.failFirstAttemptAt === name && attempts === 1) {
							throw new Error(`${name} timed out`);
						}

						if (options.failsAt === name) {
							throw Object.assign(new Error(`${name} declined`), {
								code: 'PAYMENT_DECLINED',
								retryable: false
							});
						}

						return { output: { [name]: `${name}-done` }, compensationData: { step: name } };
					},
					...(options.noCompensator === name
						? {}
						: {
								async compensate() {
									trace.compensated.push(name);

									if (options.compensateFailsAt === name) {
										throw new Error(`${name} could not be undone`);
									}
								}
						  })
				})
			)
		};
	};

	return {
		db,
		service,
		registry,
		trace,
		announcements,
		define,
		operations: db.tableOf(Operation),
		steps: db.tableOf(OperationStep)
	};
}

/** The error a settled operation records, as an object. */
const errorOf = (operation: Row): Row => JSON.parse(operation.lastError);

beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(T0);
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('starting an operation', () => {
	it('writes the header and its plan in one transaction, pending and due', async () => {
		const { service, registry, db, operations, steps, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge', 'confirm']));

		const { operation, created } = await service.start({ type: TYPE, input: { cartId: CART } });

		expect(created).toBe(true);
		expect(operation).toMatchObject({
			type: TYPE,
			status: 'PENDING',
			attemptCount: 0,
			maxAttempts: OperationService.DEFAULT_MAX_ATTEMPTS,
			correlationId: expect.any(String)
		});
		// An operation is never visible without the plan it is supposed to execute.
		expect(db.transactions).toHaveLength(1);
		expect(operations.rows).toHaveLength(1);
		expect(steps.rows.map((row) => [row.name, row.order, row.status])).toEqual([
			['reserve', 1, 'PENDING'],
			['charge', 2, 'PENDING'],
			['confirm', 3, 'PENDING']
		]);
	});

	it('refuses a type no definition is registered for, and writes nothing', async () => {
		const { service, operations } = runtime();

		await expect(service.start({ type: 'CHECKOUT_ABANDON', input: {} })).rejects.toBeInstanceOf(
			OperationTypeUnknownError
		);
		expect(operations.rows).toHaveLength(0);
	});

	it('answers a retried submission with the operation it already started', async () => {
		const { service, registry, operations, define } = runtime();

		registry.register(TYPE, define(['reserve']));

		const first = await service.start({ type: TYPE, input: { cartId: CART }, idempotencyKey: 'key-1' });
		const second = await service.start({ type: TYPE, input: { cartId: CART }, idempotencyKey: 'key-1' });

		// Control: a second run of the same submission would execute the plan twice.
		expect(second.created).toBe(false);
		expect(second.operation.id).toBe(first.operation.id);
		expect(operations.rows).toHaveLength(1);
	});

	it('refuses a second live operation for one aggregate', async () => {
		const { service, registry, operations, define } = runtime();

		registry.register(TYPE, define(['reserve']));

		const first = await service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });
		const second = await service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });

		expect(second.created).toBe(false);
		expect(second.operation.id).toBe(first.operation.id);
		expect(operations.rows).toHaveLength(1);

		// A live operation of another aggregate is not the same operation.
		const other = await service.start({
			type: TYPE,
			input: {},
			aggregateType: 'commerce_cart',
			aggregateId: '6b1e0f2a-0000-4000-8000-000000000002'
		});

		expect(other.created).toBe(true);
	});

	it('takes the deadline and the attempt budget from the definition', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, { ...define(['reserve']), defaultDeadlineMs: 5_000, maxAttempts: 7 });

		const { operation } = await service.start({ type: TYPE, input: {} });

		expect(operation.deadlineAt).toEqual(new Date(T0.getTime() + 5_000));
		expect(operation.maxAttempts).toBe(7);
	});
});

describe('driving an operation forwards', () => {
	it('runs the steps in ascending order and settles the operation completed', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge', 'confirm']));
		const { operation } = await service.start({ type: TYPE, input: { cartId: CART } });

		const result = await service.execute(operation.id as string);

		expect(trace.invoked).toEqual(['reserve', 'charge', 'confirm']);
		expect(result.executedSteps).toEqual(['reserve', 'charge', 'confirm']);
		expect(result.finished).toBe(true);
		expect(result.operation.status).toBe('COMPLETED');
		expect(result.operation.result).toMatchObject({
			steps: ['reserve', 'charge', 'confirm'],
			output: { confirm: 'confirm-done' }
		});
		expect(steps.rows.map((row) => row.status)).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED']);
	});

	it('persists a step’s outcome before the next step starts, which is what makes a restart resume', async () => {
		const { service, registry, steps } = runtime();
		const observed: unknown[] = [];

		registry.register(TYPE, {
			steps: [
				{
					name: 'reserve',
					order: 1,
					async invoke() {
						return { output: { reservationId: 'r-1' } };
					}
				},
				{
					name: 'charge',
					order: 2,
					async invoke() {
						observed.push(steps.rows.find((row) => row.name === 'reserve')?.status);

						return { output: {} };
					}
				}
			]
		});

		const { operation } = await service.start({ type: TYPE, input: {} });
		await service.execute(operation.id as string);

		expect(observed).toEqual(['COMPLETED']);
	});

	it('gives a step its input explicitly: the request, the shared variables and the earlier outputs', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const { operation } = await service.start({ type: TYPE, input: { cartId: CART } });

		await service.execute(operation.id as string);

		// A step that read the database for state it was not given would make the operation
		// unreconstructible from its own rows.
		expect(trace.inputs[0]).toEqual({ cartId: CART, variables: {}, outputs: {} });
		expect(trace.inputs[1]).toEqual({
			cartId: CART,
			variables: {},
			outputs: { reserve: { reserve: 'reserve-done' } }
		});
	});

	it('runs a completed step exactly once across two passes', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge', 'confirm']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const first = await service.execute(operation.id as string, { maxSteps: 1 });

		expect(first.executedSteps).toEqual(['reserve']);
		expect(first.finished).toBe(false);
		expect(first.operation.status).toBe('RUNNING');
		// The lease is released so another pass — in this process or another — can continue, and the
		// columns are cleared rather than a JSON member deleted: the row is what the sweep reads.
		expect(first.operation.lockedBy).toBeNull();
		expect(first.operation.leaseExpiresAt).toBeNull();

		const second = await service.execute(operation.id as string);

		expect(second.executedSteps).toEqual(['charge', 'confirm']);
		// Control: a runtime that restarted instead of resuming would have invoked `reserve` twice.
		expect(trace.invoked).toEqual(['reserve', 'charge', 'confirm']);
	});

	it('re-runs a step a crash left in flight, and resumes the rest', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge', 'confirm']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { maxSteps: 1 });

		// The crash happened after the second step was invoked and before its outcome was written.
		(steps.rows.find((row) => row.name === 'charge') as Row).status = 'RUNNING';

		const resumed = await service.resume(operation.id as string);

		expect(resumed.executedSteps).toEqual(['charge', 'confirm']);
		expect(resumed.operation.status).toBe('COMPLETED');
		expect(trace.invoked).toEqual(['reserve', 'charge', 'confirm']);
	});

	it('retries a step that failed retryably under one stable idempotency key', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(
			TYPE,
			define(['charge'], { failFirstAttemptAt: 'charge', retry: { maxAttempts: 2, baseMs: 0 } })
		);
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string);

		expect(trace.invoked).toEqual(['charge', 'charge']);
		expect(result.operation.status).toBe('COMPLETED');
		expect(steps.rows[0].attemptCount).toBe(2);
		// The key is stable across the retries of a step and across processes, so a step that calls a
		// provider passes it as the provider's own idempotency key and the second run is a no-op there.
		expect(new Set(trace.keys).size).toBe(1);
		expect(trace.keys[0]).toBe(`${operation.id}:charge`);
	});

	it('reports the current state instead of executing when another worker holds the lease', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		expect(await service.claim(operation.id as string, 'worker-a', 60_000)).not.toBeNull();
		expect(await service.claim(operation.id as string, 'worker-b', 60_000)).toBeNull();

		const result = await service.execute(operation.id as string, { ownerId: 'worker-b' });

		expect(result.executedSteps).toEqual([]);
		expect(result.finished).toBe(false);
		expect(result.operation.status).toBe('RUNNING');
		expect(trace.invoked).toEqual([]);
	});

	it('reclaims an operation whose worker died once the lease has expired', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.claim(operation.id as string, 'worker-a', 60_000);
		jest.setSystemTime(new Date(T0.getTime() + 60_001));

		const reclaimed = await service.claim(operation.id as string, 'worker-b', 60_000);

		// The lease is three columns of the row rather than a member of `state`: it is what the sweep
		// filters on, and a value inside a JSON document carries no index on any dialect.
		expect(reclaimed?.lockedBy).toBe('worker-b');
		expect(reclaimed?.lockedAt).toBeInstanceOf(Date);
		expect(reclaimed?.leaseExpiresAt).toBeInstanceOf(Date);
		expect((reclaimed?.state as Row)?.lease).toBeUndefined();
	});

	it('sweeps up the operations whose lease has lapsed, and nothing else', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));

		// Three operations: one whose worker is holding a live lease, one whose worker died, and one that
		// finished — the sweep has to name the second and neither of the others.
		const held = await service.start({ type: TYPE, input: {} });
		const abandoned = await service.start({ type: TYPE, input: {} });
		const finished = await service.start({ type: TYPE, input: {} });

		await service.claim(held.operation.id as string, 'worker-a', 60_000);
		await service.claim(abandoned.operation.id as string, 'worker-a', 60_000);
		await service.execute(finished.operation.id as string);

		// The worker of the abandoned one stops renewing; the held one renews by taking it again.
		jest.setSystemTime(new Date(T0.getTime() + 30_000));
		await service.claim(held.operation.id as string, 'worker-a', 60_000);

		jest.setSystemTime(new Date(T0.getTime() + 90_000));

		const stalled = await service.findStalled();

		expect(stalled.map((row) => row.id)).toEqual([abandoned.operation.id]);
		// A sweep reports; it does not reclaim. Reclaiming is `claim`, which decides under the row's lock.
		expect((await service.findById(abandoned.operation.id as string))?.lockedBy).toBe('worker-a');
	});

	it('does not drive an operation parked on an external decision', async () => {		const { service, registry, operations, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		(operations.rows[0] as Row).state = { ...(operations.rows[0].state as Row), awaitingApproval: true };

		expect(await service.claim(operation.id as string, 'worker-a')).toBeNull();
	});
});

describe('failing, compensating and deadlines', () => {
	it('walks the completed steps backwards when one fails, and settles the operation compensated', async () => {
		const { service, registry, trace, steps, operations, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge', 'confirm'], { failsAt: 'confirm' }));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string);

		expect(trace.invoked).toEqual(['reserve', 'charge', 'confirm']);
		// Reverse order, over the steps that ran. The failed step applied nothing, so it is not undone.
		expect(trace.compensated).toEqual(['charge', 'reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(errorOf(operations.rows[0]).code).toBe('PAYMENT_DECLINED');
		expect(result.operation.result).toMatchObject({
			compensatedSteps: ['charge', 'reserve'],
			notCompensable: [],
			compensationFailures: []
		});
		expect(steps.rows.map((row) => row.status)).toEqual(['COMPENSATED', 'COMPENSATED', 'FAILED']);
	});

	it('names a step that declares no compensator instead of pretending the aggregate is clean', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge'], { failsAt: 'charge', noCompensator: 'reserve' }));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string);

		expect(trace.compensated).toEqual([]);
		expect(result.operation.result).toMatchObject({ compensatedSteps: [], notCompensable: ['reserve'] });
		expect(steps.rows.find((row) => row.name === 'reserve')?.status).toBe('SKIPPED');
	});

	it('records a compensator that gave up and keeps walking the rest', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(
			TYPE,
			define(['reserve', 'charge', 'confirm'], { failsAt: 'confirm', compensateFailsAt: 'charge' })
		);
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string);

		// Control: an undo that swallowed the failure would report a clean aggregate while a
		// reservation is still held.
		expect(trace.compensated).toEqual(['charge', 'reserve']);
		expect(result.operation.result).toMatchObject({
			compensatedSteps: ['reserve'],
			compensationFailures: ['charge']
		});
		expect(errorOf(result.operation as Row).compensationFailures).toEqual(['charge']);
		expect(steps.rows.find((row) => row.name === 'charge')?.status).toBe('COMPENSATION_FAILED');
	});

	it('starts no further step once the deadline has passed, and compensates what it did', async () => {
		const { service, registry, trace, operations, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const { operation } = await service.start({ type: TYPE, input: {}, deadlineMs: -1_000 });

		const result = await service.execute(operation.id as string);

		expect(trace.invoked).toEqual([]);
		expect(result.executedSteps).toEqual([]);
		expect(result.finished).toBe(true);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(errorOf(operations.rows[0]).code).toBe('DEADLINE_EXCEEDED');
		expect(result.operation.result).toMatchObject({ compensatedSteps: [] });
	});

	it('reports a persisted step the definition no longer declares, and compensates the rest', async () => {
		const { service, registry, trace, steps, operations, define } = runtime();

		registry.register(TYPE, define(['charge']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		// A deployment removed the step while this operation was in flight.
		steps.rows.push(
			steps.create({ operationId: operation.id, name: 'legacy-sync', order: 0, status: 'PENDING', attemptCount: 0 })
		);

		const result = await service.execute(operation.id as string);

		expect(trace.invoked).toEqual([]);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(errorOf(operations.rows[0])).toMatchObject({
			code: 'OPERATION_STEP_UNKNOWN',
			stepName: 'legacy-sync',
			retryable: false
		});
	});

	it('refuses to drive an operation whose type this build does not know', async () => {
		const { service, operations } = runtime();

		operations.rows.push(
			operations.create({
				type: 'CHECKOUT_ABANDON',
				status: 'PENDING',
				input: {},
				state: { cursor: 0, variables: {} },
				attemptCount: 0,
				maxAttempts: 3
			})
		);

		await expect(service.execute('row-1')).rejects.toBeInstanceOf(OperationTypeUnknownError);
	});
});

describe('cancelling an operation', () => {
	it('cancels one that applied nothing outright', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const canceled = await service.cancel(operation.id as string, { reason: 'the customer withdrew' });

		expect(canceled.status).toBe('CANCELED');
		expect(canceled.result).toMatchObject({ canceled: true, reason: 'the customer withdrew', compensatedSteps: [] });
		expect(trace.invoked).toEqual([]);
	});

	it('compensates one that already changed something, rather than leaving the aggregate half-changed', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { maxSteps: 1 });

		const canceled = await service.cancel(operation.id as string, { reason: 'the customer withdrew' });

		expect(trace.compensated).toEqual(['reserve']);
		expect(canceled.status).toBe('COMPENSATED');
		expect(errorOf(canceled as Row).code).toBe('OPERATION_CANCELED');
		expect(canceled.result).toMatchObject({ compensatedSteps: ['reserve'] });
	});

	it('refuses to cancel an operation that already finished', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		await expect(service.cancel(operation.id as string)).rejects.toBeInstanceOf(ConflictException);
	});
});

describe('retrying an operation that failed', () => {
	it('re-arms the failed step under a fresh budget, and the plan runs again', async () => {
		const { service, registry, trace, steps, define } = runtime();

		registry.register(TYPE, define(['charge'], { failFirstAttemptAt: 'charge' }));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const failed = await service.execute(operation.id as string);

		expect(failed.operation.status).toBe('COMPENSATED');
		expect(trace.invoked).toEqual(['charge']);

		const retried = await service.retry(operation.id as string);

		// The same step, invoked a second time because the attempt budget it exhausted is the one the
		// retry replaced — and the stable idempotency key is what makes that safe.
		expect(trace.invoked).toEqual(['charge', 'charge']);
		expect(trace.keys[0]).toBe(trace.keys[1]);
		expect(retried.operation.status).toBe('COMPLETED');
		expect(steps.rows.find((row) => row.name === 'charge')?.attemptCount).toBe(1);
	});

	it('runs the whole plan again when the undo already happened, which is the only correct restart', async () => {
		const { service, registry, trace } = runtime();
		let confirmations = 0;

		registry.register(TYPE, {
			steps: ['reserve', 'charge', 'confirm'].map((name, index) => ({
				name,
				order: index + 1,
				invoke: async () => {
					trace.invoked.push(name);
					confirmations += name === 'confirm' ? 1 : 0;

					// The confirmation timed out once, which is the failure this case retries.
					if (name === 'confirm' && confirmations === 1) {
						throw new Error('the confirmation timed out');
					}

					return { compensationData: { step: name } };
				},
				compensate: async () => {
					trace.compensated.push(name);
				}
			}))
		});

		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		// Both completed steps were undone, so the aggregate is clean and the plan starts from the top.
		expect(trace.compensated).toEqual(['charge', 'reserve']);

		const retried = await service.retry(operation.id as string);

		expect(trace.invoked).toEqual(['reserve', 'charge', 'confirm', 'reserve', 'charge', 'confirm']);
		expect(retried.operation.status).toBe('COMPLETED');
	});

	it('hands an operation whose compensation gave up back to the compensation walk', async () => {
		const { service, registry, trace, steps } = runtime();
		let compensatorWorks = false;

		registry.register(TYPE, {
			steps: [
				{
					name: 'reserve',
					order: 1,
					invoke: async () => ({ compensationData: { reservationId: 'R1' } }),
					compensate: async () => {
						trace.compensated.push('reserve');

						if (!compensatorWorks) {
							throw new Error('the reservation service is down');
						}
					}
				},
				{
					name: 'charge',
					order: 2,
					invoke: async () => {
						throw Object.assign(new Error('declined'), { code: 'PAYMENT_DECLINED', retryable: false });
					}
				}
			]
		});

		const { operation } = await service.start({ type: TYPE, input: {} });
		const failed = await service.execute(operation.id as string);

		expect(failed.operation.status).toBe('COMPENSATED');
		expect(steps.rows.find((row) => row.name === 'reserve')?.status).toBe('COMPENSATION_FAILED');

		// The dependency the compensator needed is back, and a retry gives it a fresh budget.
		compensatorWorks = true;

		const retried = await service.retry(operation.id as string);

		// The step that failed forwards is *not* re-invoked: the outstanding work of this operation is
		// the undo, and the runtime's own rule is what says so.
		expect(trace.compensated).toEqual(['reserve', 'reserve']);
		expect(retried.operation.status).toBe('COMPENSATED');
		expect(steps.rows.find((row) => row.name === 'reserve')?.status).toBe('COMPENSATED');
		expect((retried.operation.result as Row).compensationFailures).toEqual([]);
	});

	it('refuses a retry of an operation that completed', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		await expect(service.retry(operation.id as string)).rejects.toBeInstanceOf(ConflictException);
	});

	it('refuses to resurrect work a caller cancelled', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.cancel(operation.id as string, { reason: 'the customer withdrew' });

		await expect(service.retry(operation.id as string)).rejects.toBeInstanceOf(ConflictException);
		expect(trace.invoked).toEqual([]);
	});

	it('refuses to take an operation the runtime is still driving', async () => {
		const { service, registry, trace, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		// The step budget ran out mid-plan, so the operation is running and its lease is free: a retry
		// here would clear a lease a worker may take at any moment.
		const running = await service.execute(operation.id as string, { maxSteps: 1 });
		expect(running.operation.status).toBe('RUNNING');

		await expect(service.retry(operation.id as string)).rejects.toBeInstanceOf(ConflictException);
		expect(trace.invoked).toEqual(['reserve']);

		// `resume` is the move for an operation that has not stopped, and it drives the same plan.
		const resumed = await service.resume(operation.id as string);

		expect(resumed.operation.status).toBe('COMPLETED');
		expect(trace.invoked).toEqual(['reserve', 'charge']);
	});
});

describe('announcing the facts a subscriber waits for', () => {
	it('announces a step moving exactly once per write, with the action its status states', async () => {
		const { service, registry, announcements, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		// One fact per step write — started then completed, for each of the two steps — and nothing for
		// the bookkeeping that is not a move.
		expect(announcements.stepChanged.mock.calls.map((call) => `${call[1].name}:${call[2]}`)).toEqual([
			'reserve:started',
			'reserve:completed',
			'charge:started',
			'charge:completed'
		]);
		// The operation the fact belongs to travels with it, so a subscriber never has to look it up to
		// know what moved.
		expect(announcements.stepChanged.mock.calls[0][0].id).toBe(operation.id);
	});

	it('announces the operation completing, and not the compensation that never ran', async () => {
		const { service, registry, announcements, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		expect(announcements.completed).toHaveBeenCalledTimes(1);
		expect(announcements.completed.mock.calls[0][0].status).toBe('COMPLETED');
		expect(announcements.failed).not.toHaveBeenCalled();
	});

	it('announces an operation entering compensation and then settling it', async () => {
		const { service, registry, announcements, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge'], { failsAt: 'charge' }));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);

		// Two facts about one failure, and the payload's status is what distinguishes them: the undo
		// began, and the undo finished.
		expect(announcements.failed.mock.calls.map((call) => call[1])).toEqual(['compensating', 'compensated']);
		expect(announcements.completed).not.toHaveBeenCalled();
	});

	it('announces a cancellation on the failure stream, with the status that says which it was', async () => {
		const { service, registry, announcements, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {} });

		const canceled = await service.cancel(operation.id as string, { reason: 'the customer withdrew' });

		expect(canceled.status).toBe('CANCELED');
		expect(announcements.failed).toHaveBeenCalledTimes(1);
		expect(announcements.failed.mock.calls[0][1]).toBe('canceled');
	});

	it('announces nothing when a step’s budget is reset by a retry, because nothing moved', async () => {
		const { service, registry, announcements, define } = runtime();

		registry.register(TYPE, define(['charge'], { failFirstAttemptAt: 'charge' }));
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string);
		announcements.stepChanged.mockClear();

		await service.retry(operation.id as string);

		// Only the step's second real run is announced: the reset of its attempt counter is not a move.
		expect(announcements.stepChanged.mock.calls.map((call) => `${call[1].name}:${call[2]}`)).toEqual([
			'charge:started',
			'charge:completed'
		]);
	});
});

describe('reading the queue inside the caller’s own scope', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('answers only the operations of the caller’s own tenant, and refuses the reads that name none', async () => {
		const { service, registry, operations, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		await service.start({ type: TYPE, input: {}, tenantId: 'tenant-a', organizationId: 'organization-a' });
		await service.start({ type: TYPE, input: {}, tenantId: 'tenant-b', organizationId: 'organization-b' });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-a' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('organization-a' as never);

		const rows = await service.listOperations();

		expect(rows).toHaveLength(1);
		expect(rows[0].tenantId).toBe('tenant-a');

		// The same scope narrows the two other management reads, so a caller cannot reach another
		// tenant's operation by naming its id or its aggregate.
		const foreign = operations.rows.find((row) => row.tenantId === 'tenant-b') as Row;

		expect(await service.findOperation(foreign.id)).toBeNull();
		expect(await service.findByAggregate(TYPE, foreign.aggregateId as string)).toEqual([]);
	});

	it('answers a row of the caller’s tenant whose operation names no organization', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		// A child operation, started by a step of another: the worker that ran the step had no
		// organization in its context, so the row carries none.
		await service.start({ type: TYPE, input: {}, tenantId: 'tenant-a' });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-a' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('organization-a' as never);

		// The scope is the tenant's, which is the platform's own reading of a resource: a queue that
		// dropped this row would hide work that is running for the caller's tenant.
		expect(await service.listOperations()).toHaveLength(1);
	});

	it('answers nothing at all when no credential resolved a tenant', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve']));
		const { operation } = await service.start({ type: TYPE, input: {}, tenantId: 'tenant-a' });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined as never);

		// A management read with no scope answers nothing rather than everything: these are reachable
		// only through a guarded surface, and a read that invented a scope would be a second
		// authorisation model beside the guards.
		expect(await service.listOperations()).toEqual([]);
		expect(await service.findOperation(operation.id as string)).toBeNull();
		expect(await service.findByAggregate(TYPE, 'cart-1')).toEqual([]);

		// The runtime's own reads are untouched by the scope: a worker drives the operation it claimed,
		// and `require` is what the state machine works through.
		expect((await service.findById(operation.id as string))?.id).toBe(operation.id);
	});

	it('reads the steps of several operations in one query, in execution order', async () => {
		const { service, registry, define } = runtime();

		registry.register(TYPE, define(['reserve', 'charge']));
		const first = await service.start({ type: TYPE, input: {} });
		const second = await service.start({ type: TYPE, input: {} });

		const steps = await service.findStepsForOperations([first.operation.id, second.operation.id]);

		expect(steps).toHaveLength(4);
		// One query for the set, read in the plan's own order: the reader that asked for these rows
		// groups them by operation, and within an operation they are still ascending by `order`.
		expect(steps.map((step) => step.name)).toEqual(['reserve', 'reserve', 'charge', 'charge']);
		expect(steps.filter((step) => step.operationId === first.operation.id).map((step) => step.name)).toEqual([
			'reserve',
			'charge'
		]);
		// A read of no operations asks the store nothing rather than everything.
		expect(await service.findStepsForOperations([])).toEqual([]);
	});
});
