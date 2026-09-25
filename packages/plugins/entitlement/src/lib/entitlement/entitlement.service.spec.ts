/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a rights service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * service under test is the real one**, together with the real pure rules it decides with
 * (`entitlement-rules`, the counter re-derivation and the row lock).
 *
 * The number sequence and the rule engine are substituted because this suite is about what the
 * entitlement domain does with them, not about their own semantics; the two child services are
 * substituted by doubles that write the rows the parent then re-derives its counters from, so the
 * arithmetic the assertions read is the parent's own.
 *
 * `@gauzy/config` is read at import time by the row-lock helper the package shares, so it is doubled
 * too.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/**
	 * The base CRUD class, doubled as the two halves the platform's own update is made of.
	 * `CrudService.update` is the statement a write goes through, criteria included; the tenant-aware
	 * class in front of it resolves the row first — except for a criteria that names a `version`, which
	 * the platform leaves to the statement so a stale version is answered with a conflict rather than
	 * with the pre-read's not-found.
	 */
	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async update(id: any, partial: any): Promise<any> {
			return await this.typeOrmRepository.update(id, partial);
		}
	}

	class TenantAwareCrudService extends CrudService {
		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			} else if (id && typeof id === 'object' && !('version' in id)) {
				const record = await this.typeOrmRepository.findOne({ where: id });

				if (!record) {
					throw new NotFoundException('The requested record was not found');
				}
			}

			return await super.update(id, partial);
		}
	}

	return {
		TenantAwareCrudService,
		CrudService,
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
		// The conditional write is the kernel's own, so the assertions below are about the statement it
		// issues and the affected-row count it reads, not about a stub's idea of either; the refusal a
		// transaction-scoped write raises is the kernel's exception for the same reason.
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write').commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write').versionExpectationOf,
		bumpVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').bumpVersion,
		parseEntityVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').parseEntityVersion,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
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
import { RequestContext } from '@gauzy/core';
import { ApiErrorCode } from '@gauzy/core/src/lib/core/errors/api-error-codes';
import { Entitlement } from './entitlement.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from '../entitlement-key/entitlement-key.entity';
import {
	ENTITLEMENT_NUMBER_KEY,
	EntitlementActivationStatus,
	EntitlementKeyStatus,
	EntitlementKind,
	EntitlementStatus
} from '../entitlement.enums';
import { EntitlementEventName, EntitlementRevocationReason } from '../entitlement.types';
import { EntitlementService } from './entitlement.service';

/**
 * The right itself: granting it, and the transitions that end or bend it (doc 05 §19.1).
 *
 * The specification states the invariants of this row, and each one is pinned here as behaviour:
 *
 * - **a grant replayed from the same order line, subscription or number returns the right the first
 *   call created** rather than creating a second one, which is what makes the grant step of a durable
 *   operation safe to re-run (doc 05 §19.1, doc 12);
 * - **the term must be a term**: `endsAt` is later than `startsAt` when it is set, and null is the
 *   perpetual case (doc 05 §19.1, `CHK_entitlement_term_order`);
 * - **the counters are caches re-derived by counting the live activation rows**, never incremented
 *   (doc 05 §19.1);
 * - **a revocation is terminal and idempotent**: it closes the activations, withdraws the keys and
 *   re-derives the counters, and a replay is a no-op rather than a second event (§19.1, §19.3);
 * - **an expiry is not a revocation**: both are terminal and the status says which happened, because
 *   "we took it away" and "it lapsed" are different facts about a customer (§19.1);
 * - **a partial refund lowers the ceiling rather than revoking the right**, and a right reduced to
 *   zero is revoked outright, because a right that permits nothing is not a right (§19.1);
 * - **the expiry sweep expires only what is past `endsAt + gracePeriodDays`**, and a perpetual right
 *   is never due (§19.1).
 *
 * The service is constructed directly over an in-memory datastore whose `transaction` takes a real
 * snapshot, so a refused write leaves nothing behind.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const RIGHT = 'entitlement-1';
const ORDER = 'order-1';
const ORDER_LINE = 'order-line-1';
const SUBSCRIPTION = 'subscription-1';

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
			// The one operator the service builds: `Not(REVOKED)` on the duplicate-grant lookup.
			if ((expected as Row).type === 'not') {
				return String(row[field] ?? '') !== String((expected as Row).value ?? '');
			}

			throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** One right. */
const rightRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	number: `ENT-${id}`,
	kind: EntitlementKind.LICENCE,
	quantity: 1,
	startsAt: new Date('2026-01-01T00:00:00.000Z'),
	endsAt: null as Date | null,
	gracePeriodDays: 0,
	activationLimit: null as number | null,
	activationCount: 0,
	status: EntitlementStatus.ACTIVE,
	createdAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/** One activation. */
const activationRow = (id: string, overrides: Row = {}) => ({
	id,
	entitlementId: RIGHT,
	entitlementKeyId: null,
	tenantId: TENANT,
	organizationId: ORG,
	deviceId: `device-${id}`,
	status: EntitlementActivationStatus.ACTIVE,
	activatedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/** One credential. */
const keyRow = (id: string, overrides: Row = {}) => ({
	id,
	entitlementId: RIGHT,
	tenantId: TENANT,
	organizationId: ORG,
	keyHash: `digest-${id}`,
	status: EntitlementKeyStatus.ISSUED,
	activationCount: 0,
	...overrides
});

/**
 * Builds the entitlement service over an in-memory datastore.
 *
 * @param seed What the fixture holds.
 * @param options How the substituted collaborators behave.
 */
function entitlementFixture(
	seed: { rights?: Row[]; activations?: Row[]; keys?: Row[] } = {},
	options: {
		sequence?: { formatted: string } | Error;
		assertWritable?: (input: any) => void;
		issue?: (input: any) => Promise<any>;
	} = {}
) {
	let sequence = 0;
	const tables = {
		entitlement: [...(seed.rights ?? [])],
		entitlement_activation: [...(seed.activations ?? [])],
		entitlement_key: [...(seed.keys ?? [])]
	};
	const appended: any[] = [];
	const published: any[] = [];
	const locks: string[] = [];
	const conditionsReplaced: any[] = [];
	const asserted: any[] = [];
	/** Every read the service stated, so the shape of a detail read can be asserted. */
	const findOneCalls: any[] = [];

	const tableOf = (entity: unknown): Row[] => {
		if (entity === Entitlement) {
			return tables.entitlement;
		}

		if (entity === EntitlementActivation) {
			return tables.entitlement_activation;
		}

		if (entity === EntitlementKey) {
			return tables.entitlement_key;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	/**
	 * A read hands back a *copy*, the way a database does: a later `update` moves the stored row and
	 * leaves whatever an earlier read returned exactly as it was. The double would be unfaithful
	 * without this, and the difference is observable — the `reduced` event reports the ceiling as it
	 * was before the write.
	 */
	const copy = (row: Row | undefined): Row | null => (row ? { ...row } : null);

	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, rows] of Object.entries(copy)) {
			(tables as unknown as Record<string, Row[]>)[table] = rows;
		}
	};

	/**
	 * The builder the service states two shapes on: the locked read of one right, and the page of
	 * rights the expiry sweep selects. Anything else is a statement this double does not model.
	 */
	const createQueryBuilder = (entity: unknown): any => {
		// The sweep names the table by its alias and the row lock names the entity class: both address
		// the same table, so both resolve to it.
		const target = typeof entity === 'string' ? Entitlement : entity;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const state: { take?: number } = {};
		const query: any = {
			where: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			take: (limit: number) => {
				state.take = limit;

				return query;
			},
			setLock: (mode: string) => {
				locks.push(mode);

				return query;
			},
			getOne: async () => (await query.getMany())[0] ?? null,
			getMany: async () => {
				const rows = tableOf(target).filter((row) => {
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
						if (/status != :revoked/.test(condition.sql) && String(row.status) === String(condition.params.revoked)) {
							return false;
						}
						if (/endsAt IS NOT NULL/.test(condition.sql) && (row.endsAt === null || row.endsAt === undefined)) {
							return false;
						}
					}

					return true;
				});

				const page = state.take ? rows.slice(0, state.take) : rows;

				return page.map((row) => ({ ...row }));
			}
		};

		return query;
	};

	let manager: any;
	manager = {
		connection: { options: { type: 'better-sqlite3' } },
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
		find: async (entity: unknown, options: any = {}) => {
			const found = tableOf(entity).filter((row) => matches(row, options.where));

			if (options?.order?.activatedAt === 'DESC') {
				return [...found]
					.sort(
						(left, right) => new Date(right.activatedAt ?? 0).getTime() - new Date(left.activatedAt ?? 0).getTime()
					)
					.map((row) => ({ ...row }));
			}

			return found.map((row) => ({ ...row }));
		},
		findOne: async (entity: unknown, options: any = {}) =>
			copy(tableOf(entity).find((row) => matches(row, options.where))),
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
		 * so a refused write is asserted to have left nothing behind.
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
		createQueryBuilder,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: any) => await manager.save(Entitlement, row),
		// The statement a conditional write goes through: the criteria — `version` included — decides
		// which row the patch reaches, so a row that holds another version reports nothing affected.
		update: async (criteria: any, patch: Row) => await manager.update(Entitlement, criteria, patch),
		findOne: async (options: any = {}) => {
			const { where, order } = options;

			findOneCalls.push(options);

			const found = tables.entitlement.filter((row) => matches(row, where));

			if (order?.createdAt === 'DESC') {
				return (
					[...found]
						.sort(
							(left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
						)
						.map((row) => ({ ...row }))[0] ?? null
				);
			}

			return copy(found[0]);
		}
	};

	const activationService = {
		closeAllForEntitlement: async (txManager: any, entitlementId: string, status: string, reason: string) => {
			const live = tables.entitlement_activation.filter(
				(row) => row.entitlementId === entitlementId && row.status === EntitlementActivationStatus.ACTIVE
			);

			for (const activation of live) {
				await txManager.update(
					EntitlementActivation,
					{ id: activation.id },
					status === EntitlementActivationStatus.REVOKED
						? { status, revokedAt: new Date(), revocationReason: reason }
						: { status, deactivatedAt: new Date() }
				);
			}

			return live.map((activation) => activation.id);
		}
	};
	const keyService = {
		revokeForEntitlement: async (txManager: any, entitlementId: string, reason: string) => {
			const keys = tables.entitlement_key.filter(
				(row) => row.entitlementId === entitlementId && row.status !== EntitlementKeyStatus.REVOKED
			);

			for (const key of keys) {
				await txManager.update(EntitlementKey, { id: key.id }, { status: EntitlementKeyStatus.REVOKED, revokedAt: new Date() });
			}

			return keys.map((key) => key.id);
		},
		issue:
			options.issue ??
			(async (input: any) => {
				const key = { id: 'key-issued', entitlementId: input.entitlementId, status: EntitlementKeyStatus.ISSUED };

				tables.entitlement_key.push(key);

				return { key, plaintext: 'the-plaintext' };
			})
	};
	const sequenceService = {
		allocate: async (key: string) => {
			if (options.sequence instanceof Error) {
				throw options.sequence;
			}

			return options.sequence ?? { key, formatted: 'ENT-2026-0001' };
		}
	};
	const ruleService = {
		assertWritable: (input: any) => {
			asserted.push(input);

			options.assertWritable?.(input);
		},
		replaceOwnerRules: async (owner: string, ownerId: string, inputs: any[]) => {
			conditionsReplaced.push({ owner, ownerId, inputs });
		}
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

	const service = new EntitlementService(
		repository,
		{} as never,
		activationService as never,
		keyService as never,
		sequenceService as never,
		ruleService as never,
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
		asserted,
		conditionsReplaced,
		findOneCalls,
		events: () => appended.map((event) => event.name),
		store: (id: string) => tables.entitlement.find((row) => row.id === id)
	};
}

describe('EntitlementService — granting a right (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('grants an operator’s right in force at once, numbered from the platform sequence', async () => {
		// A right granted without a purchase behind it is in force immediately: there is no payment to
		// wait for, so `PENDING` would be a state nothing moves it out of (doc 05 §19.1).
		const fixture = entitlementFixture();

		const result = await fixture.service.grant({ customerId: 'customer-1' });

		expect(result.created).toBe(true);
		expect(result.entitlement).toMatchObject({
			customerId: 'customer-1',
			kind: EntitlementKind.LICENCE,
			quantity: 1,
			gracePeriodDays: 0,
			activationCount: 0,
			status: EntitlementStatus.ACTIVE,
			number: 'ENT-2026-0001',
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.store(result.entitlement.id).endsAt).toBeNull();
		expect(fixture.events()).toEqual([EntitlementEventName.CREATED]);
		expect(fixture.appended[0]).toMatchObject({ aggregateType: 'ENTITLEMENT', tenantId: TENANT, organizationId: ORG });
		expect(fixture.published).toHaveLength(1);
	});

	it('grants a purchased right as PENDING until the money settles, unless the caller says otherwise', async () => {
		const pending = entitlementFixture();
		const immediate = entitlementFixture();

		const fromOrder = await pending.service.grant({ orderId: ORDER, orderLineId: ORDER_LINE, number: 'ENT-1' });
		const paid = await immediate.service.grant({
			orderId: ORDER,
			orderLineId: ORDER_LINE,
			number: 'ENT-1',
			activateImmediately: true
		});

		expect(fromOrder.entitlement.status).toBe(EntitlementStatus.PENDING);
		expect(paid.entitlement.status).toBe(EntitlementStatus.ACTIVE);
	});

	it('carries the quantity, the term and the grace period onto the row', async () => {
		const fixture = entitlementFixture();
		const startsAt = new Date('2026-03-01T00:00:00.000Z');
		const endsAt = new Date('2027-03-01T00:00:00.000Z');

		const { entitlement } = await fixture.service.grant({
			kind: EntitlementKind.SEAT,
			quantity: 5,
			startsAt,
			endsAt,
			gracePeriodDays: 14,
			activationLimit: 2,
			number: 'ENT-1'
		});

		expect(entitlement).toMatchObject({
			kind: EntitlementKind.SEAT,
			quantity: 5,
			startsAt,
			endsAt,
			gracePeriodDays: 14,
			activationLimit: 2
		});
	});

	it('refuses a term that ends before it starts and writes nothing', async () => {
		// `CHK_entitlement_term_order` says the same thing in the database, which is the point: the rule
		// is enforced where the row is written, not only where the request was validated.
		const fixture = entitlementFixture();
		const startsAt = new Date('2026-03-01T00:00:00.000Z');

		await expect(
			fixture.service.grant({ startsAt, endsAt: new Date(startsAt.getTime() - 1), number: 'ENT-1' })
		).rejects.toThrow(/CHK_entitlement_term_order/);
		await expect(
			fixture.service.grant({ startsAt, endsAt: startsAt, number: 'ENT-1' })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.entitlement).toEqual([]);
	});

	it('refuses a fractional seat count rather than truncating it', async () => {
		// A fractional seat count is a caller mistake: silently truncating it would grant a different
		// right than the one asked for.
		const fixture = entitlementFixture();

		await expect(fixture.service.grant({ quantity: 1.5, number: 'ENT-1' })).rejects.toThrow(/QUANTITY_INVALID/);
		expect(fixture.tables.entitlement).toEqual([]);
	});

	it('returns the right the first call created when the same granting line is replayed', async () => {
		// Idempotency is on the provenance, which is what makes the grant step of a durable operation
		// safe to re-run (doc 05 §19.1, doc 12).
		const fixture = entitlementFixture();

		const first = await fixture.service.grant({ orderId: ORDER, orderLineId: ORDER_LINE, number: 'ENT-1' });
		const replay = await fixture.service.grant({ orderId: ORDER, orderLineId: ORDER_LINE, number: 'ENT-1' });

		expect(first.created).toBe(true);
		expect(replay.created).toBe(false);
		expect(replay.entitlement.id).toBe(first.entitlement.id);
		expect(fixture.tables.entitlement).toHaveLength(1);
		// The replay announces nothing: a subscriber told twice about one grant is a subscriber that
		// sends two licences.
		expect(fixture.appended).toHaveLength(1);
		expect(fixture.published).toHaveLength(1);
	});

	it('numbers a replayed grant by its provenance and refuses to number one that has none', async () => {
		// An event consumer has no request context, so the numbering series is unreachable and the number
		// is derived from the purchase that granted the right — deterministic and unique per line.
		const derived = entitlementFixture({}, { sequence: new Error('no series in context') });

		const { entitlement } = await derived.service.grant({ orderId: ORDER, orderLineId: ORDER_LINE });
		const expected = `E-${ORDER.replace(/-/g, '').slice(0, 8).toUpperCase()}-${ORDER_LINE.replace(/-/g, '')
			.slice(0, 8)
			.toUpperCase()}-L`;

		expect(entitlement.number).toBe(expected);

		const orphan = entitlementFixture({}, { sequence: new Error('no series') });

		await expect(orphan.service.grant({ customerId: 'customer-1' })).rejects.toThrow(ENTITLEMENT_NUMBER_KEY);
		expect(orphan.tables.entitlement).toEqual([]);
	});

	it('derives a subscription’s number from the subscription', async () => {
		const fixture = entitlementFixture({}, { sequence: new Error('no series') });

		const { entitlement } = await fixture.service.grant({ subscriptionId: SUBSCRIPTION, kind: EntitlementKind.TERM });

		expect(entitlement.number).toBe('E-SUB-SUBSCRIP-T');
	});

	it('does not count a revoked right as the duplicate a replay would return', async () => {
		// "A revoked right does not count as a duplicate — a customer whose licence was withdrawn and
		// granted again has two rights, and the history is the point" (doc 05 §19.1).
		const revoked = rightRow('old', {
			orderId: ORDER,
			orderLineId: ORDER_LINE,
			status: EntitlementStatus.REVOKED,
			number: 'ENT-1'
		});
		const fixture = entitlementFixture({ rights: [revoked] });

		const result = await fixture.service.grant({ orderId: ORDER, orderLineId: ORDER_LINE, number: 'ENT-1' });

		expect(result.created).toBe(true);
		expect(result.entitlement.id).not.toBe('old');
		expect(fixture.tables.entitlement).toHaveLength(2);
	});

	it('validates the conditions before anything is written', async () => {
		// A rule the evaluator could not trust fails the whole request rather than leaving a right without
		// the conditions it was granted under (doc 05 §19.1).
		const fixture = entitlementFixture(
			{},
			{
				assertWritable: () => {
					throw new Error('the rule is not writable');
				}
			}
		);

		await expect(
			fixture.service.grant({
				number: 'ENT-1',
				conditions: [{ attribute: 'region', operator: 'EQ' } as never]
			})
		).rejects.toThrow(/not writable/);
		expect(fixture.tables.entitlement).toEqual([]);
	});

	it('writes the conditions against the right that was just granted', async () => {
		const fixture = entitlementFixture();

		const { entitlement } = await fixture.service.grant({
			number: 'ENT-1',
			conditions: [{ attribute: 'region', operator: 'EQ' } as never]
		});

		expect(fixture.conditionsReplaced).toHaveLength(1);
		expect(fixture.conditionsReplaced[0]).toMatchObject({ owner: 'ENTITLEMENT', ownerId: entitlement.id });
		expect(fixture.asserted).toHaveLength(2); // once before the write, once by `replaceConditions`
	});

	it('issues the key in the same call and returns its plaintext once', async () => {
		const fixture = entitlementFixture();

		const result = await fixture.service.grant({ number: 'ENT-1', issueKey: true, assignedToEmail: 'buyer@example.com' });

		expect(result.key).toBeDefined();
		expect(result.plaintextKey).toBe('the-plaintext');
		expect(result.entitlement.id).toBeDefined();
	});

	it('keeps the right when the key cannot be issued, and says so by returning no key', async () => {
		// A key that cannot be issued does not undo the right: an operator can issue the credential
		// afterwards, and the failure is reported rather than swallowed.
		const fixture = entitlementFixture(
			{},
			{
				issue: async () => {
					throw new Error('the key store is unreachable');
				}
			}
		);

		const result = await fixture.service.grant({ number: 'ENT-1', issueKey: true });

		expect(result.created).toBe(true);
		expect(result.key).toBeUndefined();
		expect(result.plaintextKey).toBeUndefined();
		expect(fixture.tables.entitlement).toHaveLength(1);
	});
});

describe('EntitlementService — putting a purchased right into force (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('puts every pending right of an order into force and announces each once', async () => {
		const fixture = entitlementFixture({
			rights: [
				rightRow('a', { orderId: ORDER, status: EntitlementStatus.PENDING }),
				rightRow('b', { orderId: ORDER, status: EntitlementStatus.PENDING }),
				rightRow('c', { orderId: 'another-order', status: EntitlementStatus.PENDING })
			]
		});

		const activated = await fixture.service.activateGranted({ orderId: ORDER });

		expect(activated).toEqual(['a', 'b']);
		expect(fixture.store('a').status).toBe(EntitlementStatus.ACTIVE);
		expect(fixture.store('c').status).toBe(EntitlementStatus.PENDING);
		// No seat is taken here: a right being in force is not a device using it, so no activation row is
		// written and the event carries a null activation id.
		expect(fixture.tables.entitlement_activation).toEqual([]);
		expect(fixture.events()).toEqual([EntitlementEventName.ACTIVATED, EntitlementEventName.ACTIVATED]);
		expect(fixture.appended[0].data).toMatchObject({ activationId: null, entitlementId: 'a' });
		expect(fixture.published).toHaveLength(2);
	});

	it('is idempotent: a replayed settlement event changes nothing and emits nothing', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { orderId: ORDER, status: EntitlementStatus.PENDING })] });

		await fixture.service.activateGranted({ orderId: ORDER });
		const replay = await fixture.service.activateGranted({ orderId: ORDER });

		expect(replay).toEqual([]);
		expect(fixture.appended).toHaveLength(1);
		expect(fixture.published).toHaveLength(1);
	});

	it('expires a right whose term ran out while the payment was settling instead of activating it', async () => {
		// "A payment that settles late must not create a period nobody paid for" (doc 05 §19.1).
		const fixture = entitlementFixture({
			rights: [
				rightRow('late', {
					orderId: ORDER,
					status: EntitlementStatus.PENDING,
					endsAt: new Date(Date.now() - 60_000)
				})
			]
		});

		const activated = await fixture.service.activateGranted({ orderId: ORDER });

		expect(activated).toEqual([]);
		expect(fixture.store('late').status).toBe(EntitlementStatus.EXPIRED);
	});

	// The defect: this path writes `status = EXPIRED` with a bare `manager.update` instead of going
	// through `expire`, so none of the three things a lapse means happen — no `entitlement.expired`
	// row is written to the outbox, the credentials issued against the right are left in `ISSUED` even
	// though no activation can ever consume them, and no activation is closed. Doc 05 §19.3 is
	// explicit that a credential cannot outlive the right it was issued against, and §19.1 states the
	// two lifecycle writes as one implementation ("each row is expired through the same path an
	// operator's expiry takes — one implementation, one event, one set of closed activations").
	// (`entitlement.service.ts`, the `manager.update(Entitlement, …, { status: EXPIRED })` inside
	// `activateGranted`.)
	it('lapses a late-settling right the way the ordinary expiry path does', async () => {
		const fixture = entitlementFixture({
			rights: [
				rightRow('late', {
					orderId: ORDER,
					status: EntitlementStatus.PENDING,
					endsAt: new Date(Date.now() - 60_000)
				})
			],
			keys: [keyRow('k1', { entitlementId: 'late' })]
		});

		await fixture.service.activateGranted({ orderId: ORDER });

		expect(fixture.events()).toEqual([EntitlementEventName.EXPIRED]);
		expect(fixture.tables.entitlement_key[0].status).toBe(EntitlementKeyStatus.REVOKED);
	});

	it('answers a call that names neither an order nor a subscription with nothing at all', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { status: EntitlementStatus.PENDING })] });

		expect(await fixture.service.activateGranted({})).toEqual([]);
		expect(fixture.store('a').status).toBe(EntitlementStatus.PENDING);
	});
});

describe('EntitlementService — suspending, resuming and extending (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('suspends a right and keeps its activations, because a suspended right is expected to come back', async () => {
		// "Releasing them would make a customer re-activate every machine after a payment hiccup."
		const fixture = entitlementFixture({
			rights: [rightRow('a')],
			activations: [activationRow('a1', { entitlementId: 'a' })]
		});

		const suspended = await fixture.service.suspend('a', 'PAYMENT_FAILED');

		expect(suspended).toMatchObject({ status: EntitlementStatus.SUSPENDED, suspendedReason: 'PAYMENT_FAILED' });
		expect(fixture.tables.entitlement_activation[0].status).toBe(EntitlementActivationStatus.ACTIVE);
		expect(fixture.events()).toEqual([EntitlementEventName.SUSPENDED]);
	});

	it('is idempotent when the right is already suspended', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('a', { status: EntitlementStatus.SUSPENDED, suspendedReason: 'PAYMENT_FAILED' })]
		});

		const suspended = await fixture.service.suspend('a', 'ANOTHER_REASON');

		expect(suspended.suspendedReason).toBe('PAYMENT_FAILED');
		expect(fixture.appended).toEqual([]);
	});

	it.each([[EntitlementStatus.REVOKED], [EntitlementStatus.EXPIRED]])(
		'refuses to suspend a right that is %s',
		async (status) => {
			const fixture = entitlementFixture({ rights: [rightRow('a', { status })] });

			await expect(fixture.service.suspend('a', 'why')).rejects.toThrow(/cannot be suspended/);
			expect(fixture.store('a').status).toBe(status);
		}
	);

	it('resumes a suspended right and clears the reason it was suspended for', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('a', { status: EntitlementStatus.SUSPENDED, suspendedReason: 'PAYMENT_FAILED' })]
		});

		const resumed = await fixture.service.resume('a');

		expect(resumed).toMatchObject({ status: EntitlementStatus.ACTIVE, suspendedReason: null });
		expect(fixture.published).toHaveLength(1);
	});

	it('expires rather than resumes a right whose term ran out while it was suspended', async () => {
		// Resuming it would put a customer back in force for a period nobody paid for; the grace period
		// is what expresses "still in force while a renewal is chased" (doc 05 §19.1).
		const fixture = entitlementFixture({
			rights: [
				rightRow('a', {
					status: EntitlementStatus.SUSPENDED,
					endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
					gracePeriodDays: 0
				})
			]
		});

		const outcome = await fixture.service.resume('a');

		expect(outcome.status).toBe(EntitlementStatus.EXPIRED);
		expect(fixture.events()).toEqual([EntitlementEventName.EXPIRED]);
	});

	it('answers an already active right unchanged, because the caller’s intent is already satisfied', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a')] });

		expect((await fixture.service.resume('a')).status).toBe(EntitlementStatus.ACTIVE);
		expect(fixture.published).toEqual([]);
	});

	it.each([[EntitlementStatus.PENDING], [EntitlementStatus.REVOKED]])(
		'refuses to resume a right that is %s',
		async (status) => {
			const fixture = entitlementFixture({ rights: [rightRow('a', { status })] });

			await expect(fixture.service.resume('a')).rejects.toThrow(/cannot be resumed/);
		}
	);

	it('extends the same row and returns it to force, which is what a billing cycle does', async () => {
		// Renewal is not a second mechanism: the same row is extended, so a customer's history stays one
		// right with one number (doc 05 §19.1).
		const fixture = entitlementFixture({
			rights: [
				rightRow('a', {
					status: EntitlementStatus.SUSPENDED,
					endsAt: new Date('2026-06-01T00:00:00.000Z'),
					quantity: 3
				})
			]
		});

		const extended = await fixture.service.extend('a', { endsAt: new Date('2027-06-01T00:00:00.000Z') });

		expect(extended).toMatchObject({
			status: EntitlementStatus.ACTIVE,
			suspendedReason: null,
			endsAt: new Date('2027-06-01T00:00:00.000Z'),
			quantity: 3
		});
		expect(fixture.events()).toEqual([EntitlementEventName.RENEWED]);
		expect(fixture.appended[0].data).toMatchObject({ periodEnd: new Date('2027-06-01T00:00:00.000Z'), quantity: 3 });
	});

	it('refuses an extension that does not move the end of the term forward', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { endsAt: new Date('2026-06-01T00:00:00.000Z') })] });

		await expect(fixture.service.extend('a', { endsAt: new Date('2026-06-01T00:00:00.000Z') })).rejects.toThrow(
			/must move the end of the term forward/
		);
		await expect(fixture.service.extend('a', { endsAt: new Date('2026-05-01T00:00:00.000Z') })).rejects.toThrow(
			BadRequestException
		);
		expect(fixture.store('a').endsAt).toEqual(new Date('2026-06-01T00:00:00.000Z'));
	});

	it('refuses an extension that names no instant, and one against a withdrawn right', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { endsAt: new Date('2026-06-01T00:00:00.000Z') })] });

		await expect(fixture.service.extend('a', { endsAt: new Date('not-a-date') })).rejects.toThrow(
			/must state the instant/
		);

		const revoked = entitlementFixture({ rights: [rightRow('a', { status: EntitlementStatus.REVOKED })] });

		await expect(revoked.service.extend('a', { endsAt: new Date('2027-01-01T00:00:00.000Z') })).rejects.toThrow(
			/issue a new right instead/
		);
	});
});

describe('EntitlementService — lowering the ceiling (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('gives up the surplus seats before the ceiling moves, so the count never reads above the limit', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('a', { quantity: 3 })],
			activations: [
				activationRow('a1', { entitlementId: 'a', activatedAt: new Date('2026-01-01T00:00:00.000Z') }),
				activationRow('a2', { entitlementId: 'a', activatedAt: new Date('2026-02-01T00:00:00.000Z') }),
				activationRow('a3', { entitlementId: 'a', activatedAt: new Date('2026-03-01T00:00:00.000Z') })
			]
		});

		const reduced = await fixture.service.reduce('a', 1, 'PARTIAL_REFUND');

		expect(reduced.quantity).toBe(1);
		const live = fixture.tables.entitlement_activation.filter(
			(row) => row.status === EntitlementActivationStatus.ACTIVE
		);

		expect(live).toHaveLength(1);
		expect(live[0].id).toBe('a3');
		expect(fixture.store('a').activationCount).toBe(1);
		expect(fixture.events()).toEqual([EntitlementEventName.REDUCED]);
		expect(fixture.appended[0].data).toMatchObject({
			quantityBefore: 3,
			quantity: 1,
			reason: 'PARTIAL_REFUND',
			liveActivations: 1
		});
	});

	it('revokes a right reduced to zero, because a right that permits nothing is not a right', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { quantity: 2 })], keys: [keyRow('k1', { entitlementId: 'a' })] });

		const outcome = await fixture.service.reduce('a', 0);

		expect(outcome).toMatchObject({ status: EntitlementStatus.REVOKED, revokedReason: EntitlementRevocationReason.REFUNDED });
		expect(fixture.tables.entitlement_key[0].status).toBe(EntitlementKeyStatus.REVOKED);
	});

	it('refuses a "reduction" that does not lower the quantity', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { quantity: 2 })] });

		await expect(fixture.service.reduce('a', 2)).rejects.toThrow(/must lower the quantity/);
		await expect(fixture.service.reduce('a', 5)).rejects.toThrow(BadRequestException);
		expect(fixture.store('a').quantity).toBe(2);
	});

	it('refuses a reduction of a right that is not the caller’s', async () => {
		const fixture = entitlementFixture({ rights: [] });

		await expect(fixture.service.reduce(RIGHT, 1)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EntitlementService — withdrawal and lapse (doc 05 §19.1, §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('does all four things a withdrawal means in one transaction', async () => {
		// The right becomes REVOKED, its keys are withdrawn, its live activations are closed and the
		// counters are re-derived from the rows that remain — and nothing is deleted (doc 05 §19.1).
		const fixture = entitlementFixture({
			rights: [rightRow('a', { activationCount: 2 })],
			activations: [activationRow('a1', { entitlementId: 'a' }), activationRow('a2', { entitlementId: 'a' })],
			keys: [keyRow('k1', { entitlementId: 'a' })]
		});

		const revoked = await fixture.service.revoke('a', EntitlementRevocationReason.REFUNDED);

		expect(revoked).toMatchObject({
			status: EntitlementStatus.REVOKED,
			revokedReason: EntitlementRevocationReason.REFUNDED,
			revokedByUserId: 'user-1',
			activationCount: 0
		});
		expect(revoked.revokedAt).toBeInstanceOf(Date);
		expect(fixture.tables.entitlement_activation.map((row) => row.status)).toEqual([
			EntitlementActivationStatus.REVOKED,
			EntitlementActivationStatus.REVOKED
		]);
		expect(fixture.tables.entitlement_key[0].status).toBe(EntitlementKeyStatus.REVOKED);
		expect(fixture.tables.entitlement).toHaveLength(1);
		expect(fixture.events()).toEqual([EntitlementEventName.REVOKED]);
		expect(fixture.appended[0].data).toMatchObject({ activationIds: ['a1', 'a2'] });
	});

	it('is idempotent: a replayed revocation writes no second event', async () => {
		// Which is what lets an operator re-run a revocation that half-finished.
		const fixture = entitlementFixture({
			rights: [rightRow('a', { status: EntitlementStatus.REVOKED, revokedReason: 'CHARGEBACK' })]
		});

		const revoked = await fixture.service.revoke('a', EntitlementRevocationReason.REFUNDED);

		expect(revoked.revokedReason).toBe('CHARGEBACK');
		expect(fixture.appended).toEqual([]);
		expect(fixture.published).toEqual([]);
	});

	it('expires a right as a different fact from withdrawing it, and withdraws its credentials with it', async () => {
		// "The difference between 'we took it away' and 'it lapsed' is the whole reason both values
		// exist" (doc 05 §19.1).
		const fixture = entitlementFixture({
			rights: [rightRow('a')],
			activations: [activationRow('a1', { entitlementId: 'a' })],
			keys: [keyRow('k1', { entitlementId: 'a' })]
		});

		const expired = await fixture.service.expire('a', 'TERM_ENDED');

		expect(expired.status).toBe(EntitlementStatus.EXPIRED);
		expect(expired.revokedAt).toBeUndefined();
		// A lapse closes the slot rather than withdrawing it — it records *when* the slot ended and no
		// revocation reason — which is exactly the audit difference between the two terminal states.
		expect(fixture.tables.entitlement_activation[0]).toMatchObject({
			status: EntitlementActivationStatus.EXPIRED
		});
		expect(fixture.tables.entitlement_activation[0].deactivatedAt).toBeInstanceOf(Date);
		expect(fixture.tables.entitlement_activation[0].revocationReason).toBeUndefined();
		expect(fixture.tables.entitlement_key[0].status).toBe(EntitlementKeyStatus.REVOKED);
		expect(fixture.events()).toEqual([EntitlementEventName.EXPIRED]);
	});

	it.each([[EntitlementStatus.EXPIRED], [EntitlementStatus.REVOKED]])(
		'answers an already %s right unchanged and emits nothing',
		async (status) => {
			const fixture = entitlementFixture({ rights: [rightRow('a', { status })] });

			expect((await fixture.service.expire('a')).status).toBe(status);
			expect(fixture.appended).toEqual([]);
		}
	);

	it('refuses to withdraw or expire a right that is not the caller’s', async () => {
		const fixture = entitlementFixture({ rights: [] });

		await expect(fixture.service.revoke(RIGHT, 'REFUNDED')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.expire(RIGHT)).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EntitlementService — the expiry sweep (doc 05 §19.1)', () => {
	const GRACE_END = new Date('2026-06-11T00:00:00.000Z');

	beforeEach(() => {
		jest.useFakeTimers({
			doNotFake: [
				'nextTick',
				'queueMicrotask',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'performance',
				'hrtime',
				'requestAnimationFrame',
				'cancelAnimationFrame',
				'requestIdleCallback',
				'cancelIdleCallback'
			]
		});
		jest.setSystemTime(GRACE_END);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('leaves a right in force at the last instant of its grace period and expires it one instant later', async () => {
		// The sweep expires the row only *past* `endsAt + gracePeriodDays`, which is the same edge the
		// check reads: at the closing instant the right is still exercisable, one millisecond later it is
		// not, and the sweep is what makes the second fact true.
		const fixture = entitlementFixture({
			rights: [rightRow('due', { endsAt: new Date('2026-06-01T00:00:00.000Z'), gracePeriodDays: 10 })]
		});

		expect(await fixture.service.expireDue()).toEqual([]);
		expect(fixture.store('due').status).toBe(EntitlementStatus.ACTIVE);

		jest.setSystemTime(new Date(GRACE_END.getTime() + 1));

		expect(await fixture.service.expireDue()).toEqual(['due']);
		expect(fixture.store('due').status).toBe(EntitlementStatus.EXPIRED);
	});

	it('leaves a right whose grace period has not run out alone', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('graceful', { endsAt: new Date('2026-06-01T00:00:00.000Z'), gracePeriodDays: 11 })]
		});

		jest.setSystemTime(new Date(GRACE_END.getTime() + 1));

		expect(await fixture.service.expireDue()).toEqual([]);
		expect(fixture.store('graceful').status).toBe(EntitlementStatus.ACTIVE);
	});

	it('never expires a perpetual right, and never re-expires a closed one', async () => {
		const fixture = entitlementFixture({
			rights: [
				rightRow('perpetual', { endsAt: null }),
				rightRow('revoked', { endsAt: new Date('2026-01-01T00:00:00.000Z'), status: EntitlementStatus.REVOKED }),
				rightRow('expired', { endsAt: new Date('2026-01-01T00:00:00.000Z'), status: EntitlementStatus.EXPIRED })
			]
		});

		expect(await fixture.service.expireDue()).toEqual([]);
		expect(fixture.appended).toEqual([]);
	});

	it('honours the limit one pass is given', async () => {
		const fixture = entitlementFixture({
			rights: [
				rightRow('a', { endsAt: new Date('2026-01-01T00:00:00.000Z') }),
				rightRow('b', { endsAt: new Date('2026-01-02T00:00:00.000Z') })
			]
		});

		expect(await fixture.service.expireDue(1)).toEqual(['a']);
		expect(fixture.store('b').status).toBe(EntitlementStatus.ACTIVE);
	});

	it('does not sweep the rights of another organization', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('theirs', { endsAt: new Date('2026-01-01T00:00:00.000Z'), organizationId: 'another-org' })]
		});

		expect(await fixture.service.expireDue()).toEqual([]);
	});
});

describe('EntitlementService — the counters and the conditions (doc 05 §19.1, §19.4 clause 3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('re-derives the counter from the rows rather than trusting the cache', async () => {
		// The repair is a cache column and only a cache column: the live activations are the fact.
		const fixture = entitlementFixture({
			rights: [rightRow('a', { activationCount: 7 })],
			activations: [
				activationRow('a1', { entitlementId: 'a' }),
				activationRow('a2', { entitlementId: 'a', status: EntitlementActivationStatus.RELEASED })
			]
		});

		const recount = await fixture.service.recount('a');

		expect(recount).toEqual({ entitlementId: 'a', activationCount: 1 });
		expect(fixture.store('a').activationCount).toBe(1);
	});

	it('refuses to attach conditions without a tenant to write them under', async () => {
		// An event consumer has no request context, and writing rules no later request can read is worse
		// than refusing (doc 05 §19.1).
		const fixture = entitlementFixture({ rights: [rightRow('a')] });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);

		await expect(
			fixture.service.replaceConditions('a', [{ attribute: 'region', operator: 'EQ' } as never])
		).rejects.toThrow(/ENTITLEMENT_CONDITIONS_REQUIRE_CONTEXT/);
		expect(fixture.conditionsReplaced).toEqual([]);
	});

	it('replaces the whole condition set rather than editing it rule by rule', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a')] });

		await fixture.service.replaceConditions('a', [
			{ attribute: 'region', operator: 'EQ', value: 'EU' } as never,
			{ attribute: 'customer.tier', operator: 'EQ', value: 'GOLD' } as never
		]);

		expect(fixture.conditionsReplaced).toHaveLength(1);
		expect(fixture.conditionsReplaced[0].inputs).toHaveLength(2);
		expect(fixture.conditionsReplaced[0].inputs[0]).toMatchObject({
			ownerType: 'ENTITLEMENT',
			ownerId: 'a',
			attribute: 'region',
			priority: 0
		});
		expect(fixture.conditionsReplaced[0].inputs[1]).toMatchObject({ priority: 1 });
	});

	it('reads a right with its activations and its keys for a detail view', async () => {
		const fixture = entitlementFixture({
			rights: [rightRow('a')],
			activations: [activationRow('a1', { entitlementId: 'a' })]
		});

		const detailed = await fixture.service.findOneDetailed('a');

		expect(detailed.id).toBe('a');
		// The relations are part of the read rather than a second query a caller has to remember: a
		// detail view that showed a right without its slots would be a detail view of a different thing.
		expect(fixture.findOneCalls.at(-1).relations).toMatchObject({
			customer: true,
			activations: true,
			keys: true
		});
	});

	it('reads a right of another organization as missing', async () => {
		const fixture = entitlementFixture();

		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The write a caller conditions on a version it read (doc 05 §19.1).
 *
 * The suite pins the two halves of the conditional edit, and it pins them against the kernel's own
 * conditional write rather than against a stub: `commitVersionedUpdate` is the real one, so what is
 * asserted is the statement the edit issues and the affected-row count it reads.
 *
 * - an edit whose caller accepted a version the right no longer holds is refused with
 *   `ENTITY_VERSION_CONFLICT`, and the row is left exactly as it was — this is the lost update the
 *   whole convention exists to prevent, and the refusal names both versions;
 * - an edit whose caller accepted the version the right holds lands, and the row moves exactly one
 *   revision on — because the check and the increment are one statement.
 *
 * The lifecycle writes are not covered here: they run inside the service's own transaction, which the
 * instrumented store below does not expose. Those predicate their version in the transaction's own
 * statement instead of through `commitVersionedUpdate` — `updateVersionedRow` — and the grants,
 * suspensions, resumptions, extensions, reductions, withdrawals and lapses named by the suites above
 * exercise them.
 */
describe('EntitlementService — editing under the version the caller read (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an edit based on a version the right has moved past, and writes nothing', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const refusal = await fixture.service
			.applyChanges('a', { quantity: 4 }, { wildcard: false, versions: [1] })
			.catch((error) => error);

		expect(refusal).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 1, actualVersion: 2 }
		});
		expect(fixture.store('a').quantity).toBe(1);
		expect(fixture.store('a').version).toBe(2);
	});

	it('applies an edit based on the version the caller read, one revision on', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const updated = await fixture.service.applyChanges('a', { quantity: 4 }, { wildcard: false, versions: [2] });

		expect(fixture.store('a').quantity).toBe(4);
		expect(fixture.store('a').version).toBe(3);
		expect(updated.quantity).toBe(4);
	});

	it('refuses an edit of a right that is gone, rather than reporting a conflict with it', async () => {
		const fixture = entitlementFixture();

		await expect(
			fixture.service.applyChanges('missing', { quantity: 4 }, { wildcard: false, versions: [2] })
		).rejects.toMatchObject({ status: 404, code: ApiErrorCode.RESOURCE_NOT_FOUND });
	});
});

/**
 * The transition's own statement, inside the transaction the transition opens (doc 05 §19.1).
 *
 * The lifecycle writes cannot use the conditional write the suite above pins: that helper issues its
 * statement through the service, which would step outside the transaction holding the right's row
 * lock and the outbox row the transaction exists for. The transaction therefore states the predicate
 * itself, with the increment in the same patch, and its own affected-row count is what answers a
 * version that has moved on — the same `409 ENTITY_VERSION_CONFLICT`, from the other half of the
 * mechanism.
 *
 * A suspension is the transition with the least to decide, so it is the one pinned here: its only
 * entitlement-row write is the one being asserted.
 */
describe('EntitlementService — a transition under the version the caller read (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a suspension based on a version the right has moved past, and leaves it in force', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const refusal = await fixture.service
			.suspend('a', 'PAYMENT_FAILED', {}, { wildcard: false, versions: [1] })
			.catch((error) => error);

		expect(refusal).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 1, actualVersion: 2 }
		});
		// The refused statement is the transaction's only write, so the rollback leaves the right in
		// force and announces nothing.
		expect(fixture.store('a').status).toBe(EntitlementStatus.ACTIVE);
		expect(fixture.store('a').version).toBe(2);
		expect(fixture.appended).toEqual([]);
	});

	it('applies a suspension based on the version the caller accepted, one revision on', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const suspended = await fixture.service.suspend('a', 'PAYMENT_FAILED', {}, { wildcard: false, versions: [2] });

		expect(suspended).toMatchObject({ status: EntitlementStatus.SUSPENDED, suspendedReason: 'PAYMENT_FAILED' });
		expect(fixture.store('a').version).toBe(3);
		expect(fixture.events()).toEqual([EntitlementEventName.SUSPENDED]);
	});

	/**
	 * `If-Match: "3", "4"` reaches the transition as a list whenever the guard could not read the row
	 * itself: the guard then hands on every version the caller accepted rather than the first, so a row
	 * at the second is not refused. A list is a condition on the row's version, and the statement used
	 * to be predicated on whatever the locked row held once the list had more than one member — so a
	 * right at version 7 was suspended for a caller who had accepted only 3 and 4.
	 */
	it('refuses a suspension whose caller accepted a list of versions the right has moved past', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 7 })] });

		const refusal = await fixture.service
			.suspend('a', 'PAYMENT_FAILED', {}, { wildcard: false, versions: [3, 4] })
			.catch((error) => error);

		// The first accepted version is the one named, as the guard names it when it reads the row itself.
		expect(refusal).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 3, actualVersion: 7 }
		});
		expect(fixture.store('a').status).toBe(EntitlementStatus.ACTIVE);
		expect(fixture.store('a').version).toBe(7);
		expect(fixture.appended).toEqual([]);
	});

	it('refuses a resumption whose caller accepted a list the right has moved past, although the read was not locked', async () => {
		// A resumption reads the right before its transaction opens, so it is the path where only the
		// statement's own predicate stands between a stale caller and the row.
		const fixture = entitlementFixture({
			rights: [
				rightRow('a', { status: EntitlementStatus.SUSPENDED, suspendedReason: 'PAYMENT_FAILED', version: 7 })
			]
		});

		const refusal = await fixture.service
			.resume('a', {}, { wildcard: false, versions: [3, 4] })
			.catch((error) => error);

		expect(refusal).toMatchObject({
			status: 409,
			code: ApiErrorCode.ENTITY_VERSION_CONFLICT,
			details: { expectedVersion: 3, actualVersion: 7 }
		});
		expect(fixture.store('a').status).toBe(EntitlementStatus.SUSPENDED);
		expect(fixture.store('a').version).toBe(7);
		expect(fixture.published).toEqual([]);
	});

	it('applies a suspension whose caller accepted a list that holds the right’s version, one revision on', async () => {
		// Control: the list is honoured, not collapsed to its first member — the right is at 2, the first
		// accepted version is 1, and the write lands.
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const suspended = await fixture.service.suspend(
			'a',
			'PAYMENT_FAILED',
			{},
			{ wildcard: false, versions: [1, 2] }
		);

		expect(suspended).toMatchObject({ status: EntitlementStatus.SUSPENDED });
		expect(fixture.store('a').version).toBe(3);
		expect(fixture.events()).toEqual([EntitlementEventName.SUSPENDED]);
	});

	it('keeps a wildcard a wildcard: any version the right holds, one revision on', async () => {
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 5 })] });

		const suspended = await fixture.service.suspend('a', 'PAYMENT_FAILED', {}, { wildcard: true, versions: [] });

		expect(suspended).toMatchObject({ status: EntitlementStatus.SUSPENDED });
		expect(fixture.store('a').version).toBe(6);
	});

	it('refuses a transition whose caller accepted no version at all, rather than writing it unconditionally', async () => {
		// The guard never leaves an empty list — `parseIfMatch` refuses one — so only a caller that built
		// the expectation by hand can, and it is answered as the kernel's own conditional write answers it.
		const fixture = entitlementFixture({ rights: [rightRow('a', { version: 2 })] });

		const refusal = await fixture.service
			.suspend('a', 'PAYMENT_FAILED', {}, { wildcard: false, versions: [] })
			.catch((error) => error);

		expect(refusal).toMatchObject({ status: 428, code: ApiErrorCode.VERSION_REQUIRED });
		expect(fixture.store('a').status).toBe(EntitlementStatus.ACTIVE);
		expect(fixture.store('a').version).toBe(2);
		expect(fixture.appended).toEqual([]);
	});
});
