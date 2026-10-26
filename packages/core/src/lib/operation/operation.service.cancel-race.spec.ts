import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { MultiORMEnum } from '../core/utils';
import { IOperationStepContext } from './operation.contract';
import { Operation } from './operation.entity';
import { OperationRegistry } from './operation.registry';
import { OperationService } from './operation.service';
import { mikroOrmOperationStore, IOperationStore, Row, typeOrmOperationStore } from './testing/operation-store.harness';

/**
 * A cancellation that lands while a worker is inside a step, against a real database, under both ORMs.
 *
 * `cancel()` is a request from another caller, and it writes the operation's row while the worker that
 * holds the lease is running a step: `state.cancelRequested`, and — once a step has applied something —
 * the operator's reason as an `OPERATION_CANCELED` `lastError`. The worker's own writes after the step
 * used to save back the whole object it read when it renewed its lease, and TypeORM's `save` writes every
 * column that differs from the row, so the worker's stale `state` and `lastError` went over the
 * cancellation: the flag and the reason were lost, the worker ran the rest of the plan, and `retry()` —
 * whose "cancelled by a caller" refusal reads the flag — re-drove work somebody had deliberately
 * abandoned. A worker that noticed the flag itself, between steps, wrote its own generic message over the
 * operator's reason as well.
 *
 * **Why the database is real.** The defect is which columns reach the row and in what order, and a table
 * double that shares objects with its caller cannot lose an update: the stale object and the stored row are
 * the same object. Every case here reads the outcome back from the table.
 *
 * **Each half runs on its own ORM alone.** The MikroORM half used to share one SQLite file with TypeORM,
 * because under `DB_ORM=mikro-orm` only the runtime's writes of the operation row went through MikroORM
 * while its reads, its claim and its step rows still travelled TypeORM — which knows none of the columns
 * there. Every one of those now has a MikroORM arm, so the MikroORM half is handed TypeORM repositories
 * that fail the case when touched, and the TypeORM half MikroORM ones (see `testing/operation-store.harness`).
 */

const TYPE = 'ORDER_CHECKOUT';
const REASON = 'the buyer withdrew';

/*
|--------------------------------------------------------------------------
| The harnesses
|--------------------------------------------------------------------------
*/

interface IHarness {
	service: OperationService;
	registry: OperationRegistry;
	/** The operation row as the table holds it, JSON columns parsed. */
	operationRow(id: string): Promise<Row>;
	/** A step row as the table holds it. */
	stepRow(operationId: string, name: string): Promise<Row>;
	/** How many operation-row writes each ORM's targeted update carried. */
	writes(): { typeOrm: number; mikroOrm: number };
	close(): Promise<void>;
}

/** Counts the targeted updates of the `operation` table each ORM issues. */
function countWrites() {
	const typeOrm = jest
		.spyOn(TypeOrmEntityManager.prototype, 'update')
		.mockName('TypeORM update') as jest.SpyInstance;
	const mikroOrm = jest
		.spyOn(MikroOrmEntityManager.prototype, 'nativeUpdate')
		.mockName('MikroORM nativeUpdate') as jest.SpyInstance;
	const onOperation = (spy: jest.SpyInstance) =>
		spy.mock.calls.filter(([target]) => target === Operation || target === 'Operation').length;

	return () => ({ typeOrm: onOperation(typeOrm), mikroOrm: onOperation(mikroOrm) });
}

/** The case's harness over one of the two real stores. */
async function harnessOf(createStore: () => Promise<IOperationStore>): Promise<IHarness> {
	const store = await createStore();
	const writes = countWrites();

	return {
		service: store.service,
		registry: store.registry,
		operationRow: (id) => store.operationRow(id),
		stepRow: async (operationId, name) => (await store.stepRows(operationId)).find((row) => row.name === name) as Row,
		writes,
		close: () => store.close()
	};
}

const typeOrmHarness = () => harnessOf(typeOrmOperationStore);
const mikroOrmHarness = () => harnessOf(mikroOrmOperationStore);

/** What a plan's handlers did. */
interface ITrace {
	invoked: string[];
	compensated: string[];
}

/**
 * Registers a plan over the named steps. `during` runs inside a step, after it was invoked and before it
 * returns: it is where a case lands its cancellation, and a hook that throws fails the step.
 */
function plan(
	harness: IHarness,
	names: string[],
	during: Partial<Record<string, (context: IOperationStepContext) => Promise<void>>> = {}
): ITrace {
	const trace: ITrace = { invoked: [], compensated: [] };

	harness.registry.register(TYPE, {
		steps: names.map((name, index) => ({
			name,
			order: index + 1,
			invoke: async (_input, context) => {
				trace.invoked.push(name);
				await during[name]?.(context);

				return { output: { [name]: 'done' }, compensationData: { step: name } };
			},
			compensate: async () => {
				trace.compensated.push(name);
			}
		}))
	});

	return trace;
}

/** The error a row records, as an object. */
const errorOf = (row: Row): Row => JSON.parse(row.lastError);

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
] as const)('A cancellation that lands while a worker holds the operation (%s, real SQLite)', (orm, createHarness) => {
	let harness: IHarness;

	beforeEach(async () => {
		harness = await createHarness();
	});

	afterEach(async () => {
		await harness?.close();
		jest.restoreAllMocks();
	});

	it('survives the step it landed in, and the step is undone instead of the rest of the plan running', async () => {
		const { service } = harness;
		let answered: Operation | undefined;

		// The cancellation lands inside the first step: nothing is `COMPLETED` yet, but the step is
		// applying its effect under the worker's live lease.
		const trace = plan(harness, ['reserve', 'charge'], {
			reserve: async (context) => {
				answered = await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string, { ownerId: 'worker-a' });
		const row = await harness.operationRow(operation.id as string);

		// Control: `cancel()` settled the operation `CANCELED` under the running step, the step's success
		// write then put the worker's `RUNNING` and its flag-less `state` back over it, and `charge` ran.
		// A worker holding a live lease is left to observe the request itself, between steps.
		expect(answered?.status).toBe('RUNNING');
		expect(trace.invoked).toEqual(['reserve']);
		expect(trace.compensated).toEqual(['reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(row.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
	});

	it('survives a later step’s success write, with the operator’s reason, and the undo walks every applied step', async () => {
		const { service } = harness;

		const trace = plan(harness, ['reserve', 'charge', 'confirm'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		const result = await service.execute(operation.id as string, { ownerId: 'worker-a' });
		const row = await harness.operationRow(operation.id as string);

		// Control: the success write of `charge` replaced `state` and cleared `lastError` with the values
		// the worker read before the cancellation, so `confirm` ran and the operation completed.
		expect(trace.invoked).toEqual(['reserve', 'charge']);
		expect(trace.compensated).toEqual(['charge', 'reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		// The step's own progress is merged beside the flag, not dropped for it.
		expect(row.state.cursor).toBe(2);
		expect(Object.keys(row.state.stepOutputs)).toEqual(['reserve', 'charge']);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });
		expect(row.result.error).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
	});

	it('survives the failure write of the step it landed in, and the operation records the operator’s reason', async () => {
		const { service } = harness;

		const trace = plan(harness, ['reserve', 'charge'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });

				throw Object.assign(new Error('the card was declined'), { code: 'PAYMENT_DECLINED', retryable: false });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { ownerId: 'worker-a' });

		const row = await harness.operationRow(operation.id as string);
		const step = await harness.stepRow(operation.id as string, 'charge');

		// Control: the failure write saved the worker's object back, which dropped the flag and put the
		// step's error over the reason — and `retry()` then re-drove the cancelled work.
		expect(trace.compensated).toEqual(['reserve']);
		expect(row.status).toBe('COMPENSATED');
		expect(row.state.cancelRequested).toBe(true);
		expect(row.attemptCount).toBe(1);
		expect(errorOf(row)).toMatchObject({ code: 'OPERATION_CANCELED', message: REASON });
		// Why the step failed stays on the step's own row.
		expect(errorOf(step)).toMatchObject({ code: 'PAYMENT_DECLINED' });

		await expect(service.retry(operation.id as string)).rejects.toThrow(/cancelled by a caller/);
		expect(trace.invoked).toEqual(['reserve', 'charge']);
	});

	it('answers a cancellation a worker notices between steps with the reason the operator gave', async () => {
		const { service } = harness;
		const trace = plan(harness, ['reserve', 'charge']);
		const { operation } = await service.start({ type: TYPE, input: {} });

		// A pass applies the first step and releases the lease; a second worker takes the operation.
		await service.execute(operation.id as string, { ownerId: 'worker-a', maxSteps: 1 });
		expect(await service.claim(operation.id as string, 'worker-b')).not.toBeNull();

		// The operator cancels while worker-b holds it, so the reason is recorded and the undo is left to it.
		const answered = await service.cancel(operation.id as string, { reason: REASON });
		expect(answered.status).toBe('RUNNING');

		const result = await service.execute(operation.id as string, { ownerId: 'worker-b' });
		const row = await harness.operationRow(operation.id as string);

		// Control: the worker's own check wrote "cancelled before the next step" over the operator's words.
		expect(trace.invoked).toEqual(['reserve']);
		expect(trace.compensated).toEqual(['reserve']);
		expect(result.operation.status).toBe('COMPENSATED');
		expect(errorOf(row)).toEqual({ code: 'OPERATION_CANCELED', message: REASON, retryable: false });
	});

	it(`writes the operation row through ${orm === MultiORMEnum.MikroORM ? 'MikroORM' : 'TypeORM'} alone`, async () => {
		const { service } = harness;

		plan(harness, ['reserve', 'charge'], {
			charge: async (context) => {
				await service.cancel(context.operationId, { reason: REASON });
			}
		});
		const { operation } = await service.start({ type: TYPE, input: {} });

		await service.execute(operation.id as string, { ownerId: 'worker-a' });

		// Every move of the row after `start` is a targeted update, and it is the configured ORM's: under
		// `DB_ORM=mikro-orm` TypeORM carries no column metadata for the entity. (The TypeORM half's MikroORM
		// repository throws on any member it is asked for.)
		const writes = harness.writes();

		if (orm === MultiORMEnum.MikroORM) {
			expect(writes.mikroOrm).toBeGreaterThan(0);
			expect(writes.typeOrm).toBe(0);
		} else {
			expect(writes.typeOrm).toBeGreaterThan(0);
			expect(writes.mikroOrm).toBe(0);
		}
	});
});
