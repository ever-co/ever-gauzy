import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { RequestContext } from '../core/context/request-context';
import { MultiORMEnum } from '../core/utils';
import { IOperationDefinition, IOperationStepContext } from './operation.contract';
import { OperationStep } from './operation-step.entity';
import { IOperationStore, mikroOrmOperationStore, Row, typeOrmOperationStore } from './testing/operation-store.harness';

/**
 * The durable-operation runtime on each ORM, against a real in-memory SQLite database.
 *
 * `@MultiORMColumn` and the relation decorators register an entity with the active ORM alone, so under
 * `DB_ORM=mikro-orm` TypeORM knows `Operation` and `OperationStep` as skeletons: none of the columns this
 * domain declares. The runtime was written on the TypeORM repositories — the insert that starts an
 * operation, the locked read that claims it, the stalled-lease sweep, every read by id, key and aggregate,
 * the step reads and the step writes, and the manager a step is handed — so on that ORM no operation could
 * be started, let alone driven. Only the operation-row writes had a MikroORM arm.
 *
 * Every case runs twice, once per ORM, and each run is handed the other ORM's repositories as objects that
 * fail the case the moment they are touched (`testing/operation-store.harness`). The MikroORM run is the
 * one that failed: its first `start` reached TypeORM. The TypeORM run is the control — the same outcome,
 * read back from the same table shape — and it pins that the TypeORM arm answers what it always answered.
 *
 * The MikroORM store is mapped the way production maps the entities: the scope, the parent and the owning
 * operation are `relationId` mirrors MikroORM does not persist, beside the relations that own their
 * columns, and the manager refuses work outside a request context, which is where a worker runs.
 */

const TYPE = 'ORDER_CHECKOUT';
const CART = '6b1e0f2a-0000-4000-8000-000000000001';

/** Acts as a signed-in caller of a tenant and organization, or as the runtime itself (`null`). */
function actAs(tenantId: string | null, organizationId: string | null = null): void {
	jest
		.spyOn(RequestContext, 'currentUser')
		.mockReturnValue(tenantId ? ({ id: `user-of-${tenantId}`, tenantId, lastOrganizationId: organizationId } as never) : null);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId as never);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId as never);
}

/** A plan over the named steps; `failsAt` declines without retrying, and every step can be undone. */
function plan(names: string[], options: { failsAt?: string } = {}): IOperationDefinition {
	return {
		steps: names.map((name, index) => ({
			name,
			order: index + 1,
			invoke: async () => {
				if (options.failsAt === name) {
					throw Object.assign(new Error(`${name} declined`), { code: 'PAYMENT_DECLINED', retryable: false });
				}

				return { output: { [name]: 'done' }, compensationData: { undo: name } };
			},
			compensate: async () => undefined
		}))
	};
}

/** How many rows a table holds. */
async function countOf(store: IOperationStore, table: string): Promise<number> {
	const [row] = await store.query(`SELECT COUNT(*) AS "count" FROM "${table}"`);

	return Number(row.count);
}

/** A stored instant, as epoch milliseconds. Both stores keep TypeORM's `YYYY-MM-DD HH:MM:SS.SSS` in UTC. */
function instantOf(stored: string | null): number {
	return stored ? new Date(`${stored.replace(' ', 'T')}Z`).getTime() : NaN;
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmOperationStore],
	[MultiORMEnum.MikroORM, mikroOrmOperationStore]
] as const)('The operation runtime on %s, against a real SQLite store', (orm, createStore) => {
	let store: IOperationStore;

	beforeEach(async () => {
		store = await createStore();
		actAs(null);
	});

	afterEach(async () => {
		await store?.close();
		jest.restoreAllMocks();
	});

	describe('starting an operation', () => {
		it('writes the header and its plan in the scope the submission is made in', async () => {
			store.registry.register(TYPE, plan(['reserve', 'charge']));
			actAs('tenant-a', 'org-a');

			const { operation, created } = await store.service.start({ type: TYPE, input: { cartId: CART } });
			const row = await store.operationRow(operation.id as string);
			const steps = await store.stepRows(operation.id as string);

			expect(created).toBe(true);
			expect(operation).toMatchObject({ id: row.id, type: TYPE, status: 'PENDING', tenantId: 'tenant-a' });
			// The scope reaches its columns. Under MikroORM `tenantId` and `organizationId` are mirrors the
			// ORM does not persist, so a row written through them would be stored with no scope at all.
			expect(row).toMatchObject({
				tenantId: 'tenant-a',
				organizationId: 'org-a',
				type: TYPE,
				status: 'PENDING',
				input: { cartId: CART },
				state: { cursor: 0, variables: {} },
				attemptCount: 0,
				maxAttempts: 3,
				isActive: 1,
				isArchived: 0
			});
			expect(row.correlationId).toEqual(expect.any(String));
			expect(steps.map((step) => [step.name, step.order, step.status, step.attemptCount])).toEqual([
				['reserve', 1, 'PENDING', 0],
				['charge', 2, 'PENDING', 0]
			]);
			expect(steps.every((step) => step.tenantId === 'tenant-a' && step.organizationId === 'org-a')).toBe(true);
		});

		it('writes nothing at all when its plan cannot be written', async () => {
			store.registry.register(TYPE, plan(['reserve']));
			// Two steps under one name: `UQ_operation_step` refuses the second, after the header was written.
			jest.spyOn(store.registry, 'require').mockReturnValue(plan(['reserve', 'reserve']));

			await expect(store.service.start({ type: TYPE, input: {} })).rejects.toBeInstanceOf(ConflictException);

			// The header and its plan are one transaction, so the header went with the plan.
			expect(await countOf(store, 'operation')).toBe(0);
			expect(await countOf(store, 'operation_step')).toBe(0);
		});

		it('answers a retried submission with the operation it started, and only inside the submitting tenant', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			actAs('tenant-a', 'org-a');
			const first = await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' });
			const retried = await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' });

			actAs('tenant-b', 'org-b');
			const foreign = await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' });

			expect(first.created).toBe(true);
			expect(retried).toMatchObject({ created: false, operation: { id: first.operation.id } });
			// Another tenant's key is neither found by the lookup nor refused by `UQ_operation_tenant_idem`.
			expect(foreign.created).toBe(true);
			expect(foreign.operation.id).not.toBe(first.operation.id);
			expect((await store.operationRow(foreign.operation.id as string)).tenantId).toBe('tenant-b');
			expect(await countOf(store, 'operation')).toBe(2);
		});

		it('answers a submission that lost the insert race to its own key with the winner', async () => {
			store.registry.register(TYPE, plan(['reserve']));
			actAs('tenant-a', 'org-a');

			const winner = await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' });

			// The lookup misses once, as it does for a submission whose twin committed between its read and
			// its insert: the unique index refuses the insert, and the read after it finds the winner.
			jest.spyOn(store.service, 'findByIdempotencyKey').mockResolvedValueOnce(null);

			const loser = await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' });

			expect(loser).toMatchObject({ created: false, operation: { id: winner.operation.id } });
			expect(await countOf(store, 'operation')).toBe(1);
			expect(await countOf(store, 'operation_step')).toBe(1);
		});

		it('refuses a second live operation on one aggregate, and another tenant’s live operation on it too', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			actAs('tenant-a', 'org-a');
			const first = await store.service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });
			const second = await store.service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });

			expect(second).toMatchObject({ created: false, operation: { id: first.operation.id } });

			// `UQ_operation_aggregate_live` carries no tenant, so another tenant's live operation on the
			// aggregate refuses the insert — as a conflict, and without naming the other row.
			actAs('tenant-b', 'org-b');
			const refused = store.service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });

			await expect(refused).rejects.toBeInstanceOf(ConflictException);
			await expect(refused).rejects.not.toThrow(first.operation.id as string);

			// Once the live operation has finished, the aggregate takes a new one.
			actAs('tenant-a', 'org-a');
			await store.service.execute(first.operation.id as string);

			const next = await store.service.start({ type: TYPE, input: {}, aggregateType: 'commerce_cart', aggregateId: CART });

			expect(next.created).toBe(true);
		});
	});

	describe('claiming an operation', () => {
		it('takes a pending operation, running, under a lease written to the row', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			const { operation } = await store.service.start({ type: TYPE, input: {} });
			const before = Date.now();
			const claimed = await store.service.claim(operation.id as string, 'worker-a', 60_000);
			const row = await store.operationRow(operation.id as string);

			expect(claimed).toMatchObject({ id: operation.id, status: 'RUNNING', lockedBy: 'worker-a' });
			expect(row).toMatchObject({ status: 'RUNNING', lockedBy: 'worker-a' });
			expect(row.lockedAt).not.toBeNull();
			expect(instantOf(row.leaseExpiresAt)).toBeGreaterThanOrEqual(before + 60_000);
			expect(instantOf(row.leaseExpiresAt)).toBeLessThanOrEqual(Date.now() + 60_000);
		});

		it('refuses while another worker’s lease is live, and takes the operation once that lease lapsed', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			const { operation } = await store.service.start({ type: TYPE, input: {} });
			const id = operation.id as string;

			expect(await store.service.claim(id, 'worker-a', 60_000)).not.toBeNull();
			expect(await store.service.claim(id, 'worker-b', 60_000)).toBeNull();
			expect((await store.operationRow(id)).lockedBy).toBe('worker-a');

			// The holder renews its own lease — here into the past, which is a lease that has lapsed.
			expect(await store.service.claim(id, 'worker-a', -1_000)).not.toBeNull();

			const taken = await store.service.claim(id, 'worker-b', 60_000);

			expect(taken?.lockedBy).toBe('worker-b');
			expect((await store.operationRow(id)).lockedBy).toBe('worker-b');
		});

		it('refuses an operation parked on a decision, and one that has finished', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			const parked = (await store.service.start({ type: TYPE, input: {} })).operation;
			const finished = (await store.service.start({ type: TYPE, input: {} })).operation;

			await store.query(`UPDATE "operation" SET "state" = ? WHERE "id" = ?`, [
				JSON.stringify({ cursor: 0, variables: {}, awaitingApproval: true }),
				parked.id
			]);
			await store.service.cancel(finished.id as string);

			expect(await store.service.claim(parked.id as string, 'worker-a')).toBeNull();
			expect(await store.service.claim(finished.id as string, 'worker-a')).toBeNull();
			expect((await store.operationRow(parked.id as string)).lockedBy).toBeNull();
			expect((await store.operationRow(finished.id as string)).status).toBe('CANCELED');
		});
	});

	describe('the stalled-operation sweep', () => {
		it('answers the live operations whose lease lapsed, oldest first, bounded and aged', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			const start = async () => (await store.service.start({ type: TYPE, input: {} })).operation.id as string;
			const [older, newer, healthy, untouched, done] = [await start(), await start(), await start(), await start(), await start()];

			await store.service.claim(older, 'worker-a', -3_000);
			await store.service.claim(newer, 'worker-b', -1_000);
			await store.service.claim(healthy, 'worker-c', 60_000);
			await store.service.execute(done);

			const idsOf = (rows: Row[]) => rows.map((row) => row.id);

			// A live lease, no lease at all, and a finished operation are not stalled.
			expect(idsOf(await store.service.findStalled())).toEqual([older, newer]);
			expect(idsOf(await store.service.findStalled({ limit: 1 }))).toEqual([older]);
			expect(idsOf(await store.service.findStalled({ staleMs: 2_000 }))).toEqual([older]);
			expect(untouched).toBeDefined();
		});
	});

	describe('reading an operation and its plan', () => {
		it('reads the steps of one operation, and of several, in execution order', async () => {
			store.registry.register(TYPE, plan(['reserve', 'charge', 'confirm']));

			const first = (await store.service.start({ type: TYPE, input: {} })).operation.id as string;
			const second = (await store.service.start({ type: TYPE, input: {} })).operation.id as string;
			await store.service.start({ type: TYPE, input: {} });

			const namesOf = (steps: OperationStep[], operationId: string) =>
				steps.filter((step) => step.operationId === operationId).map((step) => step.name);

			const own = await store.service.findSteps(first);
			const both = await store.service.findStepsForOperations([first, second]);

			expect(own.map((step) => [step.name, step.order, step.operationId])).toEqual([
				['reserve', 1, first],
				['charge', 2, first],
				['confirm', 3, first]
			]);
			expect(both).toHaveLength(6);
			expect(namesOf(both, first)).toEqual(['reserve', 'charge', 'confirm']);
			expect(namesOf(both, second)).toEqual(['reserve', 'charge', 'confirm']);
			expect(both.map((step) => step.order)).toEqual([1, 1, 2, 2, 3, 3]);
			expect(await store.service.findStepsForOperations([])).toEqual([]);
		});

		it('reads an operation by id as its columns', async () => {
			store.registry.register(TYPE, plan(['reserve']));
			actAs('tenant-a', 'org-a');

			const { operation } = await store.service.start({ type: TYPE, input: { cartId: CART } });
			const read = await store.service.findById(operation.id as string);

			expect(read).toMatchObject({
				id: operation.id,
				tenantId: 'tenant-a',
				organizationId: 'org-a',
				input: { cartId: CART },
				state: { cursor: 0, variables: {} }
			});
			expect(read?.deadlineAt).toBeInstanceOf(Date);
			expect(await store.service.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
		});

		it('finds a submission by its key only inside the tenant and organization it was made in', async () => {
			store.registry.register(TYPE, plan(['reserve']));

			actAs('tenant-a', 'org-a');
			const scoped = (await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' })).operation;

			actAs(null);
			const unscoped = (await store.service.start({ type: TYPE, input: {}, idempotencyKey: 'key-1' })).operation;

			expect(unscoped.id).not.toBe(scoped.id);

			actAs('tenant-a', 'org-a');
			expect((await store.service.findByIdempotencyKey(TYPE, 'key-1'))?.id).toBe(scoped.id);

			actAs('tenant-b', 'org-a');
			expect(await store.service.findByIdempotencyKey(TYPE, 'key-1')).toBeNull();

			actAs('tenant-a', 'org-b');
			expect(await store.service.findByIdempotencyKey(TYPE, 'key-1')).toBeNull();

			// No tenant asks for the tenant-less rows, never for a tenant's.
			actAs(null);
			expect((await store.service.findByIdempotencyKey(TYPE, 'key-1'))?.id).toBe(unscoped.id);
		});

		it('finds the live operation of an aggregate only inside its own tenant, and never a finished one', async () => {
			store.registry.register(TYPE, plan(['reserve']));
			actAs('tenant-a', 'org-a');

			const { operation } = await store.service.start({
				type: TYPE,
				input: {},
				aggregateType: 'commerce_cart',
				aggregateId: CART
			});

			expect((await store.service.findLiveForAggregate('commerce_cart', CART))?.id).toBe(operation.id);
			expect(await store.service.findLiveForAggregate('commerce_cart', CART, { tenantId: 'tenant-b' })).toBeNull();

			actAs('tenant-b', 'org-b');
			expect(await store.service.findLiveForAggregate('commerce_cart', CART)).toBeNull();

			actAs(null);
			expect(await store.service.findLiveForAggregate('commerce_cart', CART)).toBeNull();

			actAs('tenant-a', 'org-a');
			await store.service.execute(operation.id as string);
			expect(await store.service.findLiveForAggregate('commerce_cart', CART)).toBeNull();
		});
	});

	describe('moving an operation only inside the caller’s own scope', () => {
		it('refuses another tenant’s operation as one that does not exist, and moves the caller’s own', async () => {
			store.registry.register(TYPE, plan(['reserve', 'charge']));

			// Started and driven by the runtime itself, on behalf of tenant B.
			const { operation } = await store.service.start({ type: TYPE, input: {}, tenantId: 'tenant-b' });
			const id = operation.id as string;

			await store.service.execute(id, { maxSteps: 1 });

			actAs('tenant-a', 'org-a');
			await expect(store.service.cancel(id, { reason: 'not yours' })).rejects.toBeInstanceOf(NotFoundException);
			await expect(store.service.resume(id)).rejects.toBeInstanceOf(NotFoundException);
			expect(await store.operationRow(id)).toMatchObject({ status: 'RUNNING', lockedBy: null });

			actAs('tenant-b', 'org-b');
			const canceled = await store.service.cancel(id, { reason: 'the buyer withdrew' });

			expect(canceled.status).toBe('COMPENSATED');
			expect(await store.operationRow(id)).toMatchObject({ status: 'COMPENSATED' });
		});
	});

	describe('driving an operation', () => {
		it('records each step’s outcome on its own row, and settles the operation with no lease left', async () => {
			store.registry.register(TYPE, plan(['reserve', 'charge']));

			const { operation } = await store.service.start({ type: TYPE, input: { cartId: CART } });
			const result = await store.service.execute(operation.id as string, { ownerId: 'worker-a' });
			const row = await store.operationRow(operation.id as string);
			const steps = await store.stepRows(operation.id as string);

			expect(result).toMatchObject({ finished: true, executedSteps: ['reserve', 'charge'] });
			expect(row).toMatchObject({ status: 'COMPLETED', lockedBy: null, lockedAt: null, leaseExpiresAt: null });
			expect(row.result).toEqual({ steps: ['reserve', 'charge'], output: { charge: 'done' } });
			expect(row.state.stepOutputs).toEqual({ reserve: { reserve: 'done' }, charge: { charge: 'done' } });
			expect(steps.map((step) => [step.name, step.status, step.attemptCount])).toEqual([
				['reserve', 'COMPLETED', 1],
				['charge', 'COMPLETED', 1]
			]);
			expect(steps[0]).toMatchObject({ output: { reserve: 'done' }, compensationData: { undo: 'reserve' } });
			expect(steps[1].input).toMatchObject({ cartId: CART, outputs: { reserve: { reserve: 'done' } } });
		});

		it('records a failed step and the undo of the steps before it', async () => {
			store.registry.register(TYPE, plan(['reserve', 'charge'], { failsAt: 'charge' }));

			const { operation } = await store.service.start({ type: TYPE, input: {} });

			await store.service.execute(operation.id as string);

			const row = await store.operationRow(operation.id as string);
			const steps = await store.stepRows(operation.id as string);

			expect(row).toMatchObject({ status: 'COMPENSATED', attemptCount: 1, lockedBy: null });
			expect(JSON.parse(row.lastError)).toMatchObject({ code: 'PAYMENT_DECLINED', stepName: 'charge' });
			expect(steps.map((step) => [step.name, step.status])).toEqual([
				['reserve', 'COMPENSATED'],
				['charge', 'FAILED']
			]);
			expect(JSON.parse(steps[1].lastError)).toMatchObject({ code: 'PAYMENT_DECLINED' });
		});

		it('hands a step the configured ORM’s manager, made for the attempt, and the step’s local writes land', async () => {
			const contexts: IOperationStepContext[] = [];
			const seen: number[] = [];
			const ledger = `INSERT INTO "step_ledger" ("entry", "operationId") VALUES (?, ?)`;

			store.registry.register(TYPE, {
				steps: ['reserve', 'charge'].map((name, index) => ({
					name,
					order: index + 1,
					invoke: async (_input: unknown, context: IOperationStepContext) => {
						contexts.push(context);

						// The discriminant narrows the manager to its ORM's type, which is what a step writes by.
						if (context.orm === MultiORMEnum.MikroORM) {
							// An entity read on a fork is a context-specific call the installation's own manager
							// refuses outside a request — which is where a worker runs this step.
							seen.push((await context.manager.find('OperationStep', { operationId: context.operationId })).length);
							await context.manager.getConnection().execute(ledger, [context.idempotencyKey, context.operationId], 'run');
						} else {
							seen.push((await context.manager.find(OperationStep, { where: { operationId: context.operationId } })).length);
							await context.manager.query(ledger, [context.idempotencyKey, context.operationId]);
						}

						return {};
					}
				}))
			});

			const { operation } = await store.service.start({ type: TYPE, input: {} });

			await store.service.execute(operation.id as string);

			expect(contexts.map((context) => context.orm)).toEqual([orm, orm]);
			expect(seen).toEqual([2, 2]);

			if (orm === MultiORMEnum.MikroORM) {
				expect(contexts.every((context) => context.manager instanceof MikroOrmEntityManager)).toBe(true);
				// A fork per attempt, never the installation's own manager.
				expect(contexts.some((context) => context.manager === store.mikroOrm?.em)).toBe(false);
				expect(contexts[0].manager).not.toBe(contexts[1].manager);
			} else {
				expect(contexts.every((context) => context.manager instanceof TypeOrmEntityManager)).toBe(true);
			}

			expect(await store.query(`SELECT "entry" FROM "step_ledger" ORDER BY "entry"`)).toEqual([
				{ entry: `${operation.id}:charge` },
				{ entry: `${operation.id}:reserve` }
			]);
		});
	});
});
