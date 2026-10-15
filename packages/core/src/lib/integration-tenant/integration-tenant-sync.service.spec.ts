import '../core/entities/internal';

import { AsyncLocalStorage } from 'async_hooks';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { RequestContext } from '../core/context/request-context';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import {
	INTEGRATION_TENANT_AGGREGATE_TYPE,
	INTEGRATION_TENANT_SYNCED,
	IntegrationTenantSyncService
} from './integration-tenant-sync.service';

/**
 * Recording a finished integration synchronisation: the connection's `lastSyncedAt` and the
 * `integration_tenant.synced` fact `Subscription.integrationSyncCompleted` follows, in one transaction.
 *
 * No integration announced a finished run — there was no shared "sync completed" moment at all (§7.68 class 5) — so
 * the fact is new, and these cases hold the one way it is written. The store below has **real transaction
 * semantics** on both ORMs' shapes: a write inside the transaction is staged on the transaction's own copy of the
 * table and of the outbox and committed only when the body returns, and the outbox double appends onto the copy of
 * the manager it is handed. So each case asserts against the committed store that the stamp and the fact commit
 * together, that a fact that cannot be appended takes the stamp back, and that nothing is written for a connection
 * the tenant does not own or for a run that states no tenant.
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ORG_A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
const CONNECTION_A = 'c0c0c0c0-0000-4000-8000-00000000000a';
const CONNECTION_B = 'c0c0c0c0-0000-4000-8000-00000000000b';

type Row = Record<string, any>;

/** Plain equality, the criteria the service states. */
const matches = (row: Row, where: Row = {}): boolean =>
	Object.entries(where).every(([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected));

/** A store of `integration_tenant` rows and outbox rows with real transaction semantics, in either ORM's shape. */
function store() {
	const committed = {
		rows: [
			{ id: CONNECTION_A, name: 'GITHUB', integrationId: 'catalogue-github', tenantId: TENANT_A, organizationId: ORG_A, lastSyncedAt: null },
			{ id: CONNECTION_B, name: 'GITHUB', integrationId: 'catalogue-github', tenantId: TENANT_B, organizationId: 'org-b', lastSyncedAt: null }
		] as Row[],
		outbox: [] as Row[]
	};
	let failAppend = false;

	const begin = () => ({ rows: committed.rows.map((row) => ({ ...row })), outbox: [...committed.outbox] });
	const commit = (staged: ReturnType<typeof begin>) => {
		committed.rows = staged.rows;
		committed.outbox = staged.outbox;
	};

	/** TypeORM's transactional manager, as far as the service reads it. */
	const typeOrmManager = (staged: ReturnType<typeof begin>) => ({
		staged,
		findOne: async (_entity: unknown, { where }: { where: Row }) => {
			const row = staged.rows.find((candidate) => matches(candidate, where));
			return row ? { ...row } : null;
		},
		update: async (_entity: unknown, where: Row, patch: Row) => {
			for (const row of staged.rows.filter((candidate) => matches(candidate, where))) Object.assign(row, patch);
		}
	});
	/** MikroORM's transactional fork, as far as the service reads it. */
	const mikroOrmManager = (staged: ReturnType<typeof begin>) => ({
		staged,
		findOne: async (_entity: unknown, where: Row) => {
			const row = staged.rows.find((candidate) => matches(candidate, where));
			return row ? { ...row } : null;
		},
		nativeUpdate: async (_entity: unknown, where: Row, patch: Row) => {
			const rows = staged.rows.filter((candidate) => matches(candidate, where));
			for (const row of rows) Object.assign(row, patch);
			return rows.length;
		}
	});

	const typeOrmRepository = {
		manager: {
			transaction: async (work: (manager: any) => Promise<unknown>) => {
				const staged = begin();
				const result = await work(typeOrmManager(staged));
				commit(staged);
				return result;
			}
		}
	};
	const mikroOrmRepository = {
		getEntityManager: () => ({
			transactional: async (work: (em: any) => Promise<unknown>) => {
				const staged = begin();
				const result = await work(mikroOrmManager(staged));
				commit(staged);
				return result;
			}
		})
	};
	const outbox = {
		append: async (manager: { staged?: ReturnType<typeof begin> }, event: Row) => {
			if (failAppend) throw new Error('the outbox is unavailable');
			// An append handed anything but a transaction's manager has nowhere to go but the committed store, and
			// the case that reads `inTransaction` says so.
			(manager.staged ?? committed).outbox.push({ ...event, inTransaction: Boolean(manager.staged) });
			return event;
		}
	};

	return {
		typeOrmRepository,
		mikroOrmRepository,
		outbox,
		failAppend: () => (failAppend = true),
		row: (id: string) => committed.rows.find((row) => row.id === id),
		facts: () => committed.outbox
	};
}

describe('IntegrationTenantSyncService — a finished synchronisation, stamped and announced together', () => {
	const originalClsService = RequestContext['clsService'];
	const originalOrm = process.env.DB_ORM;

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
	});

	const serviceOver = (db: ReturnType<typeof store>) =>
		new IntegrationTenantSyncService(
			db.typeOrmRepository as never,
			db.mikroOrmRepository as never,
			db.outbox as never,
			new SubscriptionCatalogue()
		);

	/** Runs work as a signed-in user of one tenant and organization. */
	const as = <T>(tenantId: string, organizationId: string, work: () => T): T =>
		RequestContext.runWithRequest(
			{ user: { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } } as never,
			work
		);

	describe.each([
		['TypeORM', 'typeorm'],
		['MikroORM', 'mikro-orm']
	])('on %s', (_label, orm) => {
		beforeEach(() => {
			process.env.DB_ORM = orm;
		});

		it('stamps the connection and appends the fact in the same transaction, with the counts the run stated', async () => {
			const db = store();

			const recorded = await as(TENANT_A, ORG_A, () =>
				serviceOver(db).recordSyncCompleted(CONNECTION_A, { counts: { issue: 3, label: 2 } })
			);

			expect(db.row(CONNECTION_A)?.lastSyncedAt).toBeInstanceOf(Date);
			expect(recorded.lastSyncedAt).toEqual(db.row(CONNECTION_A)?.lastSyncedAt);
			expect(db.facts()).toHaveLength(1);
			expect(db.facts()[0]).toMatchObject({
				name: INTEGRATION_TENANT_SYNCED,
				aggregateType: INTEGRATION_TENANT_AGGREGATE_TYPE,
				aggregateId: CONNECTION_A,
				tenantId: TENANT_A,
				organizationId: ORG_A,
				inTransaction: true,
				data: {
					integrationTenantId: CONNECTION_A,
					integrationId: 'catalogue-github',
					name: 'GITHUB',
					counts: { issue: 3, label: 2 }
				}
			});
			expect(db.facts()[0].data.syncedAt).toEqual(db.row(CONNECTION_A)?.lastSyncedAt);
		});

		it('takes the stamp back when the fact cannot be appended, so neither commits', async () => {
			const db = store();
			db.failAppend();

			await expect(as(TENANT_A, ORG_A, () => serviceOver(db).recordSyncCompleted(CONNECTION_A))).rejects.toThrow(
				/outbox is unavailable/
			);

			expect(db.row(CONNECTION_A)?.lastSyncedAt).toBeNull();
			expect(db.facts()).toEqual([]);
		});

		it("writes nothing for another tenant's connection — or another organization's — named by id", async () => {
			const db = store();

			await expect(as(TENANT_A, ORG_A, () => serviceOver(db).recordSyncCompleted(CONNECTION_B))).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(
				as(TENANT_A, ORG_A, () => serviceOver(db).recordSyncCompleted(CONNECTION_A, { organizationId: ORG_A2 }))
			).rejects.toBeInstanceOf(NotFoundException);

			expect([db.row(CONNECTION_A)?.lastSyncedAt, db.row(CONNECTION_B)?.lastSyncedAt]).toEqual([null, null]);
			expect(db.facts()).toEqual([]);
		});
	});

	it('takes the tenant a run outside any request states, and refuses a run that states none', async () => {
		const db = store();

		await serviceOver(db).recordSyncCompleted(CONNECTION_B, { tenantId: TENANT_B, organizationId: 'org-b' });
		expect(db.facts().map((fact) => [fact.aggregateId, fact.tenantId])).toEqual([[CONNECTION_B, TENANT_B]]);

		await expect(serviceOver(db).recordSyncCompleted(CONNECTION_A)).rejects.toBeInstanceOf(BadRequestException);
		expect(db.row(CONNECTION_A)?.lastSyncedAt).toBeNull();
		expect(db.facts()).toHaveLength(1);
	});

	it('hands subscribers counts only: a member that is not a whole non-negative number is dropped', async () => {
		const db = store();

		await as(TENANT_A, ORG_A, () =>
			serviceOver(db).recordSyncCompleted(CONNECTION_A, {
				counts: { issue: 2.7, project: -1, task: Number.NaN, client: 'x' as never, label: 0 }
			})
		);

		expect(db.facts()[0].data.counts).toEqual({ issue: 2, label: 0 });
	});

	it('declares the fact with the subscription catalogue, so `Subscription.events` may select it too', () => {
		const catalogue = new SubscriptionCatalogue();
		const consumer = { register: jest.fn() };

		new IntegrationTenantSyncService({} as never, {} as never, {} as never, catalogue, consumer as never).onModuleInit();

		expect(catalogue.names()).toEqual([INTEGRATION_TENANT_SYNCED]);
		expect(consumer.register).toHaveBeenCalledTimes(1);
	});
});
