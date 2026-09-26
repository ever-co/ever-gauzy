/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a seat-counting service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**: only the base classes, the request context, the two
 * collaborators it delegates to and the entity mappings are substituted.
 *
 * The rule engine and the credential service are substituted because this suite is about the seat
 * arithmetic and the event it produces, not about the evaluator's own semantics or the digest of a
 * key. The manager is a real (if tiny) transactional store, so "nothing was written" is asserted
 * against state rather than against a call log.
 *
 * `@gauzy/config` is read at import time by the row-lock helper the package shares, so it is doubled
 * too — and its value decides whether the lock is taken, which one case below asserts.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The ORM the services branch on. These suites drive the TypeORM path, which is what the doubles model;
		// both ORMs are driven against real SQLite in `entitlement-lifecycle.dual-orm.spec.ts`.
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		TenantAwareCrudService: class {},
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			currentIp: () => null,
			currentUserAgent: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivation } from './entitlement-activation.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import { EntitlementActivationStatus, EntitlementKeyStatus, EntitlementStatus } from '../entitlement.enums';
import { EntitlementCheckReason } from '../entitlement.types';
import { digestLicenceKey } from '../entitlement-key/licence-key';
import { ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS, EntitlementActivationService } from './entitlement-activation.service';

/**
 * Taking, giving back and being deprived of a slot (doc 05 §19.2).
 *
 * The seat arithmetic is the whole point of the domain and the specification states it as invariants:
 *
 * - **a slot is taken only while the right is `ACTIVE`, inside its term, and below both its `quantity`
 *   and its `activationLimit`** — the two ceilings are different questions and both are asked
 *   (§19.2, §23 I-68);
 * - the limits are checked **under a lock on the entitlement row**, so two devices activating at the
 *   same instant cannot both take the last slot (§19.1, §19.4 clause 2);
 * - **an activation is unique per `(entitlement, device)` among live rows**, which is what makes a
 *   retried first run idempotent rather than a second slot (§19.2);
 * - the counters are **caches re-derived by counting the live rows**, never incremented (§19.1);
 * - `RELEASED` and `REVOKED` are the same arithmetic and different audit facts, so the status is an
 *   enum rather than a boolean (§19.2);
 * - `lastSeenAt` is written **at most once per configured interval**, so a client that validates on
 *   every launch cannot turn validation into a write storm (§19.4 clause 4);
 * - a key is spent by the activation that consumed it, in the same transaction, so no device ever
 *   holds a seat under a key that still looks unused (§19.3).
 *
 * The service is constructed directly over an in-memory datastore whose `transaction` takes a real
 * snapshot, so a refused activation leaves nothing behind.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const RIGHT = 'entitlement-1';
const DEVICE = 'device-1';

type Row = Record<string, any>;

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
			throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** The right an activation is taken against. */
const rightRow = (overrides: Row = {}) => ({
	id: RIGHT,
	tenantId: TENANT,
	organizationId: ORG,
	number: 'ENT-0001',
	kind: 'SEAT',
	quantity: 1,
	startsAt: new Date('2026-01-01T00:00:00.000Z'),
	endsAt: null as Date | null,
	gracePeriodDays: 0,
	activationLimit: null as number | null,
	activationCount: 0,
	status: EntitlementStatus.ACTIVE,
	...overrides
});

/** One activation row. */
const activationRow = (id: string, overrides: Row = {}) => ({
	id,
	entitlementId: RIGHT,
	entitlementKeyId: null,
	tenantId: TENANT,
	organizationId: ORG,
	deviceId: `device-${id}`,
	status: EntitlementActivationStatus.ACTIVE,
	activatedAt: new Date('2026-02-01T00:00:00.000Z'),
	lastSeenAt: new Date('2026-02-01T00:00:00.000Z'),
	...overrides
});

/** One credential row. */
const keyRow = (id: string, overrides: Row = {}) => ({
	id,
	entitlementId: RIGHT,
	tenantId: TENANT,
	organizationId: ORG,
	keyHash: digestLicenceKey(`key-${id}`),
	keyPrefix: `key-${id}`.slice(0, 8),
	status: EntitlementKeyStatus.ISSUED,
	activationCount: 0,
	expiresAt: null,
	...overrides
});

/**
 * Builds the activation service over an in-memory datastore.
 *
 * @param seed What the fixture holds, and how the connection behaves.
 */
function activationFixture(
	seed: {
		rights?: Row[];
		activations?: Row[];
		keys?: Row[];
		dialect?: string;
		conditions?: { matched: boolean; failedRules?: string[] };
	} = {}
) {
	let sequence = 0;
	const tables = {
		entitlement: [...(seed.rights ?? [rightRow()])],
		entitlement_activation: [...(seed.activations ?? [])],
		entitlement_key: [...(seed.keys ?? [])]
	};
	const appended: any[] = [];
	const published: any[] = [];
	/** Every statement the row lock was asked for, so the lock can be asserted rather than described. */
	const locks: string[] = [];

	const tableOf = (entity: unknown): Row[] => {
		if (entity === EntitlementActivation) {
			return tables.entitlement_activation;
		}

		if (entity === EntitlementKey) {
			return tables.entitlement_key;
		}

		if (entity === Entitlement) {
			return tables.entitlement;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, rows] of Object.entries(copy)) {
			(tables as unknown as Record<string, Row[]>)[table] = rows;
		}
	};

	const createQueryBuilder = (entity: unknown): any => {
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			where: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			setLock: (mode: string) => {
				locks.push(mode);

				return query;
			},
			getOne: async () => {
				const rows = tableOf(entity).filter((row) => {
					for (const condition of conditions) {
						if (/\.id = :id/.test(condition.sql) && String(row.id) !== String(condition.params.id)) {
							return false;
						}
						if (/deletedAt IS NULL/.test(condition.sql) && row.deletedAt) {
							return false;
						}
						if (/tenantId = :tenantId/.test(condition.sql) && String(row.tenantId) !== String(condition.params.tenantId)) {
							return false;
						}
						if (
							/organizationId = :organizationId/.test(condition.sql) &&
							String(row.organizationId) !== String(condition.params.organizationId)
						) {
							return false;
						}
					}

					return true;
				});

				return rows[0] ?? null;
			}
		};

		return query;
	};

	let manager: any;
	manager = {
		connection: { options: { type: seed.dialect ?? 'better-sqlite3' } },
		createQueryBuilder,
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const table = tableOf(entity);

			for (const row of list) {
				const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;

				if (index >= 0) {
					table[index] = { ...table[index], ...row };
					continue;
				}

				if (!row.id) {
					row.id = `generated-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		find: async (entity: unknown, options: any = {}) => tableOf(entity).filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) => {
			const found = tableOf(entity).filter((row) => matches(row, options.where));

			if (options?.order?.revokedAt === 'DESC') {
				return (
					[...found].sort(
						(left, right) => new Date(right.revokedAt ?? 0).getTime() - new Date(left.revokedAt ?? 0).getTime()
					)[0] ?? null
				);
			}

			return found[0] ?? null;
		},
		count: async (entity: unknown, options: any = {}) =>
			tableOf(entity).filter((row) => matches(row, options.where)).length,
		update: async (entity: unknown, criteria: any, patch: Row) => {
			const row = tableOf(entity).find((candidate) => matches(candidate, criteria));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		/**
		 * A real (if tiny) transaction: the tables are copied and a throw from inside restores the copy,
		 * so "nothing was written" is asserted against state.
		 */
		transaction: async (run: (transactional: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(manager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		}
	};

	const repository: any = {
		manager,
		findOne: async ({ where }: any = {}) => tables.entitlement_activation.find((row) => matches(row, where)) ?? null,
		find: async ({ where, order }: any = {}) => {
			const found = tables.entitlement_activation.filter((row) => matches(row, where));

			if (order?.activatedAt === 'DESC') {
				return [...found].sort(
					(left, right) => new Date(right.activatedAt ?? 0).getTime() - new Date(left.activatedAt ?? 0).getTime()
				);
			}

			return found;
		},
		create: (partial: Row) => ({ ...partial })
	};
	const keyService = {
		consume: async (txManager: any, key: any) => {
			await txManager.update(EntitlementKey, { id: key.id }, { status: EntitlementKeyStatus.ACTIVATED });

			return key;
		}
	};
	const checkService = {
		evaluateConditions: async () =>
			seed.conditions ?? { matched: true, failedRules: [], unresolvedAttributes: [] }
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};
	const eventBus = {
		publish: async (event: any) => {
			published.push(event);

			return event;
		}
	};

	const service = new EntitlementActivationService(
		repository,
		{} as never,
		keyService as never,
		checkService as never,
		outbox as never,
		eventBus as never
	);

	return {
		service,
		manager,
		tables,
		locks,
		appended,
		published,
		events: () => appended.map((event) => event.name),
		store: (id: string) => tables.entitlement_activation.find((row) => row.id === id),
		live: () =>
			tables.entitlement_activation.filter((row) => row.status === EntitlementActivationStatus.ACTIVE)
	};
}

/** One activation input, so a case states only what it is about. */
const request = (overrides: Row = {}) => ({ entitlementId: RIGHT, deviceId: DEVICE, ...overrides });

describe('EntitlementActivationService — taking a slot (doc 05 §19.2, §19.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('takes the last seat of a right, records the device and derives the counters from the rows', async () => {
		const fixture = activationFixture();

		const result = await fixture.service.activate(request({ deviceName: 'Ana’s laptop' }) as never);

		expect(result.created).toBe(true);
		expect(result.remainingQuantity).toBe(0);
		expect(fixture.store(result.activation.id)).toMatchObject({
			entitlementId: RIGHT,
			deviceId: DEVICE,
			deviceName: 'Ana’s laptop',
			status: EntitlementActivationStatus.ACTIVE,
			createdByUserId: 'user-1'
		});
		// The counter is the count of live rows, written by the same transaction that wrote the row.
		expect(fixture.tables.entitlement[0].activationCount).toBe(1);
		expect(fixture.events()).toEqual(['entitlement.activated']);
		expect(fixture.appended[0].data).toMatchObject({ activationId: result.activation.id, liveActivations: 1 });
		expect(fixture.published).toHaveLength(1);
	});

	it('refuses an activation that names no device', async () => {
		const fixture = activationFixture();

		await expect(fixture.service.activate({ entitlementId: RIGHT } as never)).rejects.toThrow(
			/ENTITLEMENT_DEVICE_REQUIRED/
		);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('refuses an activation against a right that is not the caller’s', async () => {
		const fixture = activationFixture({ rights: [] });

		await expect(fixture.service.activate(request() as never)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('is idempotent: a retried first run refreshes the row the first run wrote instead of taking a second slot', async () => {
		// The partial unique index over the live rows is what makes a retry safe, and the refresh is what
		// makes it useful: the device is the identity, not the call.
		const fixture = activationFixture();

		const first = await fixture.service.activate(request() as never);
		const second = await fixture.service.activate(request({ deviceName: 'renamed' }) as never);

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.activation.id).toBe(first.activation.id);
		expect(fixture.live()).toHaveLength(1);
		expect(fixture.tables.entitlement[0].activationCount).toBe(1);
		// One row, one slot, one announcement: the refresh is not a second activation.
		expect(fixture.events()).toEqual(['entitlement.activated']);
	});

	it('records a new row for a device whose previous activation was revoked', async () => {
		// "A `REVOKED` activation is immutable and a re-activation on the same device is a **new row**,
		// which is exactly why the unique index is partial on `status = 'ACTIVE'`" (doc 05 §19.2).
		const fixture = activationFixture({
			activations: [activationRow('old', { deviceId: DEVICE, status: EntitlementActivationStatus.REVOKED, revokedAt: new Date('2026-01-15T00:00:00.000Z') })]
		});

		const result = await fixture.service.activate(request() as never);

		expect(result.created).toBe(true);
		expect(result.activation.id).not.toBe('old');
		expect(fixture.tables.entitlement_activation).toHaveLength(2);
	});
});

describe('EntitlementActivationService — the two ceilings a slot is checked against (doc 05 §19.1, §19.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses the activation that would exceed the seat count, and writes nothing at all', async () => {
		const fixture = activationFixture();

		await fixture.service.activate(request() as never);

		await expect(fixture.service.activate(request({ deviceId: 'device-2' }) as never)).rejects.toMatchObject({
			message: expect.stringContaining(EntitlementCheckReason.QUANTITY_EXHAUSTED)
		});
		expect(fixture.live()).toHaveLength(1);
		expect(fixture.tables.entitlement[0].activationCount).toBe(1);
	});

	it('accepts the activation that exactly fills the seat count and refuses the one past it', async () => {
		// The boundary itself: two seats admit two devices, not one and not three.
		const fixture = activationFixture({ rights: [rightRow({ quantity: 2 })] });

		expect((await fixture.service.activate(request({ deviceId: 'd1' }) as never)).created).toBe(true);
		expect((await fixture.service.activate(request({ deviceId: 'd2' }) as never)).created).toBe(true);
		await expect(fixture.service.activate(request({ deviceId: 'd3' }) as never)).rejects.toThrow(
			EntitlementCheckReason.QUANTITY_EXHAUSTED
		);
		expect(fixture.live()).toHaveLength(2);
	});

	it('refuses an activation when the right’s own simultaneous-activation ceiling is reached', async () => {
		// `quantity` is what the customer bought and `activationLimit` is what the right permits at once:
		// the tighter of the two is the one that decides, and the code names it.
		const fixture = activationFixture({ rights: [rightRow({ quantity: 10, activationLimit: 1, activationCount: 1 })] });

		await expect(fixture.service.activate(request({ deviceId: 'd2' }) as never)).rejects.toThrow(
			EntitlementCheckReason.ACTIVATION_LIMIT_REACHED
		);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('gives the seat back when a device releases it, so the next device may take it', async () => {
		const fixture = activationFixture();
		const first = await fixture.service.activate(request() as never);

		const released = await fixture.service.release(first.activation.id, 'uninstalled');

		expect(released.status).toBe(EntitlementActivationStatus.RELEASED);
		expect(released.deactivatedAt).toBeInstanceOf(Date);
		expect(fixture.tables.entitlement[0].activationCount).toBe(0);
		expect((await fixture.service.activate(request({ deviceId: 'd2' }) as never)).created).toBe(true);
	});

	it('lets an unlimited right be activated without limit and reports no remaining figure', async () => {
		// `quantity = 0` means unlimited (doc 05 §19.1), so the seat ceiling is not a ceiling.
		const fixture = activationFixture({ rights: [rightRow({ quantity: 0, kind: 'USAGE' })] });

		for (const deviceId of ['d1', 'd2', 'd3']) {
			const result = await fixture.service.activate(request({ deviceId }) as never);

			expect(result.created).toBe(true);
			expect(result.remainingQuantity).toBeNull();
		}
		expect(fixture.live()).toHaveLength(3);
	});
});

describe('EntitlementActivationService — the state and the term (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[EntitlementStatus.PENDING, EntitlementCheckReason.PENDING],
		[EntitlementStatus.SUSPENDED, EntitlementCheckReason.SUSPENDED],
		[EntitlementStatus.EXPIRED, EntitlementCheckReason.EXPIRED],
		[EntitlementStatus.REVOKED, EntitlementCheckReason.REVOKED]
	])('refuses an activation against a %s right with %s', async (status, reason) => {
		const fixture = activationFixture({ rights: [rightRow({ status })] });

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(reason);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('refuses an activation before the term opens', async () => {
		const fixture = activationFixture({
			rights: [rightRow({ startsAt: new Date(Date.now() + 60_000) })]
		});

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(
			EntitlementCheckReason.TERM_NOT_STARTED
		);
	});

	it('refuses an activation past the term, grace period included', async () => {
		const fixture = activationFixture({
			rights: [rightRow({ endsAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), gracePeriodDays: 10 })]
		});

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(EntitlementCheckReason.EXPIRED);
	});
});

describe('EntitlementActivationService — the credential (doc 05 §19.2, §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('spends the key it was presented, in the same transaction that took the seat', async () => {
		const fixture = activationFixture({ keys: [keyRow('k1')] });

		const result = await fixture.service.activate(request({ key: 'key-k1' }) as never);

		expect(result.activation.entitlementKeyId).toBe('k1');
		expect(fixture.tables.entitlement_key[0].status).toBe(EntitlementKeyStatus.ACTIVATED);
		// The key's own counter is re-derived from the rows that reference it.
		expect(fixture.tables.entitlement_key[0].activationCount).toBe(1);
	});

	it('refuses a key that was already spent', async () => {
		const fixture = activationFixture({ keys: [keyRow('k1', { status: EntitlementKeyStatus.ACTIVATED })] });

		await expect(fixture.service.activate(request({ key: 'key-k1' }) as never)).rejects.toThrow(
			EntitlementCheckReason.KEY_USED
		);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('refuses a key that was not issued for this right', async () => {
		const fixture = activationFixture({ keys: [keyRow('k1', { entitlementId: 'another-right' })] });

		await expect(fixture.service.activate(request({ key: 'key-k1' }) as never)).rejects.toThrow(
			EntitlementCheckReason.KEY_NOT_FOUND
		);
		expect(fixture.tables.entitlement_activation).toEqual([]);
	});

	it('refuses a device that was withdrawn for sharing a credential or for fraud', async () => {
		// A revocation that the customer could undo by trying again would be a formality, which is why the
		// reason and not only the status bars the return (§19.2, the activation service's own rule).
		const fixture = activationFixture({
			activations: [
				activationRow('old', {
					deviceId: DEVICE,
					status: EntitlementActivationStatus.REVOKED,
					revokedAt: new Date('2026-01-15T00:00:00.000Z'),
					revocationReason: 'KEY_SHARING'
				})
			]
		});

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(/ENTITLEMENT_DEVICE_BARRED/);
		expect(fixture.live()).toEqual([]);
	});

	it('lets a device withdrawn for an ordinary reason come back', async () => {
		// Control for the refusal above: a support agent replacing a machine records an ordinary reason
		// and the customer re-activates.
		const fixture = activationFixture({
			activations: [
				activationRow('old', {
					deviceId: DEVICE,
					status: EntitlementActivationStatus.REVOKED,
					revokedAt: new Date('2026-01-15T00:00:00.000Z'),
					revocationReason: 'HARDWARE_REPLACED'
				})
			]
		});

		expect((await fixture.service.activate(request() as never)).created).toBe(true);
	});
});

describe('EntitlementActivationService — the conditions attached to a right (doc 02 §1.16)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an activation the right’s conditions do not permit, naming what failed', async () => {
		const fixture = activationFixture({
			conditions: { matched: false, failedRules: ['region'] }
		});

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(
			`${EntitlementCheckReason.CONDITIONS_NOT_MET}: region`
		);
		// The seat is not taken and the counter is not moved: a condition is evaluated before the write.
		expect(fixture.tables.entitlement_activation).toEqual([]);
		expect(fixture.tables.entitlement[0].activationCount).toBe(0);
	});
});

describe('EntitlementActivationService — giving a slot back (doc 05 §19.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('tells a voluntary release from an imposed revocation, which is the whole reason the status is an enum', async () => {
		const fixture = activationFixture({ activations: [activationRow('a1'), activationRow('a2')] });

		const released = await fixture.service.release('a1', 'uninstalled');
		const revoked = await fixture.service.revoke('a2', 'KEY_SHARING');

		expect(released).toMatchObject({
			status: EntitlementActivationStatus.RELEASED,
			revocationReason: 'uninstalled',
			revokedByUserId: 'user-1'
		});
		expect(released.deactivatedAt).toBeInstanceOf(Date);
		expect(released.revokedAt).toBeUndefined();
		expect(revoked).toMatchObject({
			status: EntitlementActivationStatus.REVOKED,
			revocationReason: 'KEY_SHARING'
		});
		expect(revoked.revokedAt).toBeInstanceOf(Date);
		expect(fixture.tables.entitlement[0].activationCount).toBe(0);
		expect(fixture.events()).toEqual(['entitlement.deactivated', 'entitlement.deactivated']);
	});

	it('is idempotent: closing an already closed activation emits nothing a second time', async () => {
		const fixture = activationFixture({
			activations: [activationRow('a1', { status: EntitlementActivationStatus.RELEASED })]
		});

		const closed = await fixture.service.release('a1');

		expect(closed.status).toBe(EntitlementActivationStatus.RELEASED);
		expect(fixture.appended).toEqual([]);
		expect(fixture.published).toEqual([]);
	});

	it('refuses a slot that is not the caller’s', async () => {
		const fixture = activationFixture({ activations: [activationRow('a1', { organizationId: 'another-org' })] });

		await expect(fixture.service.release('a1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('closes every live activation of a right, which is what a revocation or an expiry does', async () => {
		const fixture = activationFixture({
			activations: [
				activationRow('a1', { status: EntitlementActivationStatus.ACTIVE }),
				activationRow('a2', { status: EntitlementActivationStatus.RELEASED }),
				activationRow('a3', { status: EntitlementActivationStatus.ACTIVE })
			]
		});

		const closed = await fixture.service.closeAllForEntitlement(
			fixture.manager,
			RIGHT,
			EntitlementActivationStatus.EXPIRED,
			'TERM_ENDED'
		);

		expect(closed).toEqual(['a1', 'a3']);
		expect(fixture.store('a1').status).toBe(EntitlementActivationStatus.EXPIRED);
		// A lapse is not a withdrawal: the row records when it was deactivated, not who revoked it.
		expect(fixture.store('a1').deactivatedAt).toBeInstanceOf(Date);
		expect(fixture.store('a2').status).toBe(EntitlementActivationStatus.RELEASED);
	});
});

describe('EntitlementActivationService — the last-seen throttle (doc 05 §19.4 clause 4)', () => {
	const STALE = new Date('2026-02-01T00:00:00.000Z');

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not write a timestamp a chatty client asks for twice inside the interval', async () => {
		// The throttle is what keeps a client that validates on every launch from turning the endpoint
		// into a write amplifier: the recent timestamp is left exactly as it was.
		const recent = new Date();
		const fixture = activationFixture({ activations: [activationRow('a1', { lastSeenAt: recent })] });

		const touched = await fixture.service.touch('a1');

		expect(new Date(touched.lastSeenAt as unknown as string).getTime()).toBe(recent.getTime());
		expect(new Date(fixture.tables.entitlement_activation[0].lastSeenAt).getTime()).toBe(recent.getTime());
	});

	it('refreshes the timestamp once the configured interval has passed', async () => {
		const fixture = activationFixture({ activations: [activationRow('a1', { lastSeenAt: STALE })] });

		const touched = await fixture.service.touch('a1');

		expect(new Date(touched.lastSeenAt as unknown as string).getTime()).toBeGreaterThan(STALE.getTime());
	});

	it('refreshes an activation that has never been seen', async () => {
		const fixture = activationFixture({ activations: [activationRow('a1', { lastSeenAt: null })] });

		expect((await fixture.service.touch('a1')).lastSeenAt).toBeInstanceOf(Date);
	});

	it('honours an interval the caller states rather than the configured one, in both directions', async () => {
		// The interval is a property of how chatty the client is, which is why it is stated per call: a
		// client that validates once a day should not write a timestamp on every launch because another
		// client does.
		const fiveSecondsAgo = new Date(Date.now() - 5000);
		const fixture = activationFixture({ activations: [activationRow('a1', { lastSeenAt: fiveSecondsAgo })] });

		const throttled = await fixture.service.touch('a1', 3600);

		expect(new Date(throttled.lastSeenAt as unknown as string).getTime()).toBe(fiveSecondsAgo.getTime());

		const forced = await fixture.service.touch('a1', 0);

		expect(new Date(forced.lastSeenAt as unknown as string).getTime()).toBeGreaterThan(fiveSecondsAgo.getTime());
	});

	it('refuses a slot that is not the caller’s', async () => {
		const fixture = activationFixture();

		await expect(fixture.service.touch('missing')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EntitlementActivationService — reading a right’s slots (doc 05 §19.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists a right’s activations newest first, live ones included', async () => {
		const fixture = activationFixture({
			activations: [
				activationRow('old', { activatedAt: new Date('2026-01-01T00:00:00.000Z') }),
				activationRow('new', { activatedAt: new Date('2026-03-01T00:00:00.000Z') }),
				activationRow('gone', {
					activatedAt: new Date('2026-02-01T00:00:00.000Z'),
					status: EntitlementActivationStatus.RELEASED
				})
			]
		});

		expect((await fixture.service.findForEntitlement(RIGHT)).map((row) => row.id)).toEqual(['new', 'gone', 'old']);
	});

	it('does not list the slots of a right in another organization', async () => {
		const fixture = activationFixture({
			activations: [activationRow('a1', { organizationId: '00000000-0000-4000-8000-000000000099' })]
		});

		expect(await fixture.service.findForEntitlement(RIGHT)).toEqual([]);
		await expect(fixture.service.findOneScoped('a1')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EntitlementActivationService — the row lock the seat arithmetic depends on (doc 05 §19.4 clause 2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('takes a row lock on a dialect that has one and none where the transaction is already exclusive', async () => {
		const postgres = activationFixture({ dialect: 'postgres' });

		await postgres.service.activate(request() as never);

		expect(postgres.locks).toEqual(['pessimistic_write']);

		const embedded = activationFixture({ dialect: 'better-sqlite3' });

		await embedded.service.activate(request() as never);

		expect(embedded.locks).toEqual([]);
	});

	it('counts the seats under the lock rather than from the cache, so a stale counter cannot oversell', async () => {
		// The right's cached counter says zero while two rows are live. Counting the rows is what makes
		// the refusal below correct; reading the cache would have admitted a third device.
		const fixture = activationFixture({
			rights: [rightRow({ quantity: 2, activationCount: 0 })],
			activations: [activationRow('a1'), activationRow('a2')]
		});

		await expect(fixture.service.activate(request() as never)).rejects.toThrow(
			EntitlementCheckReason.QUANTITY_EXHAUSTED
		);
		expect(fixture.live()).toHaveLength(2);
	});
});

/**
 * The correction path (`PUT /entitlement-activations/:id`, `updateEntitlementActivation`).
 *
 * Both surfaces reached the inherited update with the slot's state and identity in the body, and the
 * inherited update writes what it is handed. With a right whose `activationLimit` is one, activation A
 * `REVOKED` and activation B `ACTIVE`, an edit of `{ status: ACTIVE }` on A left two live slots against a
 * limit of one — the limit is counted only when a slot is taken — and an edit of `entitlementId` moved a
 * slot onto another right without that right's ceiling being asked. The service now refuses every member
 * the slot's own operations write, before the base write runs.
 *
 * The base class is doubled at the module boundary, so the base write this override delegates to is
 * installed on the double for these cases only: it writes the partial onto the stored row, which is what
 * the platform's own `update` does, so a refusal that failed to fire would show in the table.
 */
describe('EntitlementActivationService — what a correction may not move (doc 05 §19.2)', () => {
	let written: Array<{ id: unknown; partial: Row }>;

	/** Installs the base write over the fixture's table. */
	function withBaseWrite(fixture: ReturnType<typeof activationFixture>) {
		(TenantAwareCrudService.prototype as any).update = async function (id: string, partial: Row) {
			written.push({ id, partial });
			// An `undefined` member is left out of the statement, as the ORM leaves it out of the `SET`.
			Object.assign(
				fixture.store(id) as Row,
				Object.fromEntries(Object.entries(partial).filter(([, value]) => value !== undefined))
			);

			return { affected: 1, raw: [] };
		};

		return fixture;
	}

	beforeEach(() => {
		written = [];
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => {
		delete (TenantAwareCrudService.prototype as any).update;
		jest.restoreAllMocks();
	});

	it('refuses to reinstate a revoked slot past the activation limit, and writes nothing', async () => {
		const fixture = withBaseWrite(
			activationFixture({
				rights: [rightRow({ quantity: 5, activationLimit: 1, activationCount: 1 })],
				activations: [
					activationRow('a1', { status: EntitlementActivationStatus.REVOKED, revocationReason: 'replaced' }),
					activationRow('a2', { status: EntitlementActivationStatus.ACTIVE })
				]
			})
		);

		await expect(
			fixture.service.update('a1', { status: EntitlementActivationStatus.ACTIVE } as any)
		).rejects.toThrow(/ENTITLEMENT_ACTIVATION_FIELD_NOT_EDITABLE: status is not written by an edit/);

		expect(fixture.store('a1').status).toBe(EntitlementActivationStatus.REVOKED);
		expect(fixture.live()).toHaveLength(1);
		expect(written).toEqual([]);
	});

	it('refuses to repoint a slot at another right, whose ceiling was never asked', async () => {
		const fixture = withBaseWrite(activationFixture({ activations: [activationRow('a1')] }));

		await expect(fixture.service.update('a1', { entitlementId: 'entitlement-2' } as any)).rejects.toBeInstanceOf(
			BadRequestException
		);

		expect(fixture.store('a1').entitlementId).toBe(RIGHT);
		expect(written).toEqual([]);
	});

	it.each([
		['the device the seat is counted over', { deviceId: 'another-device' }],
		['the key whose revocation releases the slot', { entitlementKeyId: 'key-2' }],
		['the reason that bars a withdrawn device', { revocationReason: null }],
		['the instant the slot was revoked', { revokedAt: null }]
	])('refuses %s', async (_label, partial) => {
		const fixture = withBaseWrite(
			activationFixture({
				activations: [activationRow('a1', { status: EntitlementActivationStatus.REVOKED, revocationReason: 'FRAUD' })]
			})
		);

		await expect(fixture.service.update('a1', partial as any)).rejects.toBeInstanceOf(BadRequestException);

		expect(fixture.store('a1')).toMatchObject({ deviceId: 'device-a1', revocationReason: 'FRAUD' });
		expect(written).toEqual([]);
	});

	it('refuses every member its own operations write, and names each one the body carried', async () => {
		const fixture = withBaseWrite(activationFixture({ activations: [activationRow('a1')] }));
		const everything = Object.fromEntries(ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS.map((member) => [member, 'x']));

		await expect(fixture.service.update('a1', everything as any)).rejects.toThrow(
			new RegExp(`${ENTITLEMENT_ACTIVATION_LIFECYCLE_MEMBERS.join(', ')} are not written by an edit`)
		);
		expect(written).toEqual([]);
	});

	it('hands the descriptive fields to the base write unchanged', async () => {
		const fixture = withBaseWrite(activationFixture({ activations: [activationRow('a1')] }));
		const correction = {
			deviceName: "Ana's laptop",
			seatReference: 'seat-7',
			metadata: { os: 'linux' },
			// A DTO instance spells an absent member as an own property holding `undefined`; that is "not
			// stated", and it must not be read as naming the member.
			status: undefined
		};

		await expect(fixture.service.update('a1', correction as any)).resolves.toEqual({ affected: 1, raw: [] });

		expect(written).toEqual([{ id: 'a1', partial: correction }]);
		expect(fixture.store('a1')).toMatchObject({
			deviceName: "Ana's laptop",
			seatReference: 'seat-7',
			status: EntitlementActivationStatus.ACTIVE
		});
	});
});
