/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a session state machine needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the session service, and the collection and provider services it composes with, all
 * over in-memory doubles of their repositories. Only the base CRUD class, the request context and the
 * entity base classes are substituted, and the money kernel is pulled through the seam with
 * `requireActual`, so the capacity arithmetic below is the platform's own.
 *
 * The base-class double mirrors the platform's `CrudService` where the behaviour is observable to a
 * caller: `findOneByWhereOptions` raises `NotFoundException` for an absent row on both ORM branches
 * (`crud.service.ts`, lines 451–469) rather than answering the `null` its prose promises. The session
 * service reads its own rows through `find` and `create` rather than through that method, so the cases
 * below are unaffected by the discrepancy; it is recorded where it bites, in the provider and
 * collection suites.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PaymentCollectionStatus, PaymentSessionStatus } from '../payment.types';
import { PaymentAuthorizedEvent, PaymentCanceledEvent, PaymentFailedEvent } from '../events';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { PaymentProviderService } from '../payment-provider/payment-provider.service';
import { PaymentSessionService } from './payment-session.service';

/**
 * The lifetime of one attempt with one provider (doc 10 §8.5, §8.11).
 *
 * Four rules, and the suite walks each of them:
 *
 * 1. **One live attempt per `(collection, provider)`.** A new attempt for the same pair supersedes the
 *    previous one — cancelled with `metadata.supersededBy`, never deleted — and an attempt that
 *    already reached `AUTHORIZED` refuses to be superseded at all, because the money it reserved is
 *    real. That is what makes a retry a retry rather than a second charge (doc 10 §8.4, I-33).
 * 2. **The live attempts of a collection may not add up to more than it is for.** The check is on the
 *    sum, so a split payment across providers is what it is for, and one cent past the collection
 *    amount is refused with `PAYMENT_COLLECTION_MISMATCH` (doc 10 §8.4).
 * 3. **An off-session attempt is never asked for a next action.** With `paymentMethodTokenId` set,
 *    `clientSecret` stays null and `REQUIRES_MORE` is unreachable: there is nobody to complete a
 *    redirect, so a provider that answers with one is recorded as a decline rather than parked in a
 *    state that would expire in silence (doc 10 §8.11 step 5, I-29).
 * 4. **A terminal attempt is never re-opened,** and the sweep closes what outlived its lifetime:
 *    `PENDING`, `PENDING_AUTHORIZATION` and `REQUIRES_MORE` past `expiresAt` become `EXPIRED`, while
 *    an attempt that reserved money keeps it (doc 10 §8.5).
 *
 * Messages are asserted by the code they carry, because that is what a client branches on.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const COLLECTION = 'collection-1';
const OTHER_COLLECTION = 'collection-2';
const PROVIDER = 'provider-1';
const OTHER_PROVIDER = 'provider-2';
const OTHER_SESSION = 'session-theirs';

/** The declared lifetime of a session, read off the setting this package contributes. */
const TTL_MINUTES = 60;

type Row = Record<string, any>;

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * The double states the `where` the service states — equality, `null`, the `$in` / `$notIn` set
 * operators the status filters are written with, and the TypeORM `In` / `Not` spellings — because a
 * double that returned every row regardless would make every "one live attempt" case vacuous.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: Record<string, Row[]>, tableName: string) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const inSet = (row: Row, field: string, members: unknown[], negated: boolean) => {
		const found = members.some((one) => String(row[field] ?? '') === String(one));

		return negated ? !found : found;
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'in') {
					return inSet(row, field, expected.value as unknown[], false);
				}
				if (expected.type === 'not') {
					const inner = expected.value as FindOperator<unknown>;

					return inSet(row, field, inner.value as unknown[], true);
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			if (expected && typeof expected === 'object' && ('$in' in expected || '$notIn' in expected)) {
				const operator = expected as { $in?: unknown[]; $notIn?: unknown[] };

				return operator.$in
					? inSet(row, field, operator.$in, false)
					: inSet(row, field, operator.$notIn as unknown[], true);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	return {
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${tableName}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `payment_collection` row, as the composed collection service reads it. */
const collectionRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: 'order-1',
	amount: '100',
	currency: 'USD',
	status: PaymentCollectionStatus.NOT_PAID,
	authorizedAmount: '0',
	capturedAmount: '0',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/** One `payment_provider` row, as the composed provider service reads it. */
const providerRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id,
	name: `Provider ${id}`,
	isEnabled: true,
	isTestMode: false,
	sortOrder: 0,
	...overrides
});

/** One `payment_session` row, as the service reads it. */
const sessionRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	collectionId: COLLECTION,
	providerId: PROVIDER,
	status: PaymentSessionStatus.PENDING,
	amount: '40',
	currency: 'USD',
	...overrides
});

/**
 * Builds the session service over one in-memory datastore, composing the real collection and provider
 * services over their own doubles.
 *
 * @param options The rows the fixture starts with.
 */
function world(
	options: { collections?: Row[]; providers?: Row[]; sessions?: Row[] } = {}
) {
	const tables: Record<string, Row[]> = {
		payment_collection: options.collections ?? [collectionRow(COLLECTION), collectionRow(OTHER_COLLECTION)],
		payment_provider: options.providers ?? [providerRow(PROVIDER), providerRow(OTHER_PROVIDER)],
		payment_session: options.sessions ?? []
	};
	const published: any[] = [];
	const collectionService = new PaymentCollectionService(
		repository(tables, 'payment_collection') as never,
		{} as never
	);
	const providerService = new PaymentProviderService(repository(tables, 'payment_provider') as never, {} as never);
	const service = new PaymentSessionService(
		repository(tables, 'payment_session') as never,
		{} as never,
		collectionService,
		providerService,
		{
			publish: async (event: any) => {
				published.push(event);

				return event;
			}
		} as never
	);

	return {
		service,
		collectionService,
		tables,
		published,
		session: (id: string) => tables.payment_session.find((row) => row.id === id),
		collection: (id: string = COLLECTION) => tables.payment_collection.find((row) => row.id === id),
		liveSessions: () =>
			tables.payment_session.filter(
				(row) =>
					![
						PaymentSessionStatus.CAPTURED,
						PaymentSessionStatus.CANCELED,
						PaymentSessionStatus.ERROR,
						PaymentSessionStatus.EXPIRED
					].includes(row.status)
			)
	};
}

/** An attempt to open, so a case states only what it is about. */
const attempt = (overrides: Row = {}) => ({
	collectionId: COLLECTION,
	providerId: PROVIDER,
	amount: '40',
	currency: 'USD',
	...overrides
});

describe('PaymentSessionService — opening an attempt (doc 10 §8.4, §8.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('opens a pending attempt in the collection’s currency, with the declared lifetime and no money moved', async () => {
		const fixture = world();
		const before = Date.now();

		const opened = await fixture.service.openSession(attempt({ amount: '40.00', currency: 'usd' }) as never);
		const after = Date.now();

		expect(opened).toMatchObject({
			collectionId: COLLECTION,
			providerId: PROVIDER,
			status: PaymentSessionStatus.PENDING,
			amount: '40',
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG
		});
		// The lifetime is the setting this package contributes, so the fallback and the documented
		// default cannot drift apart.
		const expiry = new Date(opened.expiresAt as unknown as string).getTime();

		expect(expiry).toBeGreaterThanOrEqual(before + TTL_MINUTES * 60 * 1000);
		expect(expiry).toBeLessThanOrEqual(after + TTL_MINUTES * 60 * 1000);

		// Opening an attempt reserves nothing: the collection is waiting, not authorised.
		expect(fixture.collection()).toMatchObject({
			status: PaymentCollectionStatus.AWAITING,
			authorizedAmount: '0',
			capturedAmount: '0'
		});
		expect(fixture.liveSessions()).toHaveLength(1);
	});

	it('keeps the expiry the caller stated instead of the default one', async () => {
		const fixture = world();
		const stated = new Date('2026-03-01T09:00:00.000Z');

		const opened = await fixture.service.openSession(attempt({ expiresAt: stated }) as never);

		expect(new Date(opened.expiresAt as unknown as string).toISOString()).toBe(stated.toISOString());
	});

	it('stores a client secret for a buyer-present attempt and none for an off-session one', async () => {
		// Doc 10 §8.11 step 3: an attempt on a saved instrument carries the token and **no** client
		// secret, because there is no client to hand one to.
		const buyerPresent = world();

		expect(
			(await buyerPresent.service.openSession(attempt({ clientSecret: 'cs_1' }) as never)).clientSecret
		).toBe('cs_1');

		const offSession = world();
		const opened = await offSession.service.openSession(
			attempt({ paymentMethodTokenId: 'token-1', amount: '10' }) as never
		);

		expect(opened.paymentMethodTokenId).toBe('token-1');
		expect(opened.clientSecret).toBeNull();
	});

	it('refuses an off-session attempt that carries a client secret', async () => {
		const fixture = world();

		await expect(
			fixture.service.openSession(
				attempt({ paymentMethodTokenId: 'token-1', clientSecret: 'cs_1' }) as never
			)
		).rejects.toThrow(/issues no client secret/);
		expect(fixture.tables.payment_session).toEqual([]);
	});

	it('refuses an off-session attempt that asks to wait for a buyer who is not there', async () => {
		// REQUIRES_MORE is unreachable off-session (I-29): a session parked in it would expire in silence.
		const fixture = world();

		await expect(
			fixture.service.openSession(
				attempt({ paymentMethodTokenId: 'token-1', status: PaymentSessionStatus.REQUIRES_MORE }) as never
			)
		).rejects.toThrow(/REQUIRES_MORE is unreachable off-session/);
		expect(fixture.tables.payment_session).toEqual([]);
	});

	it('refuses an amount that is not a positive exact decimal', async () => {
		const fixture = world();

		await expect(fixture.service.openSession(attempt({ amount: '0' }) as never)).rejects.toThrow(
			/PAYMENT_SESSION_AMOUNT_INVALID/
		);
		await expect(fixture.service.openSession(attempt({ amount: '-40' }) as never)).rejects.toThrow(
			/PAYMENT_SESSION_AMOUNT_INVALID/
		);
		await expect(fixture.service.openSession(attempt({ amount: 'forty' }) as never)).rejects.toThrow(
			/PAYMENT_AMOUNT_INVALID/
		);
		expect(fixture.tables.payment_session).toEqual([]);
	});

	it('refuses an amount in a currency the collection is not in', async () => {
		const fixture = world();

		await expect(fixture.service.openSession(attempt({ currency: 'EUR' }) as never)).rejects.toThrow(
			/does not match collection currency/
		);
		expect(fixture.tables.payment_session).toEqual([]);
	});

	it('refuses a provider that has been withdrawn, and one this organization does not have', async () => {
		const withdrawn = world({
			providers: [providerRow(PROVIDER, { isEnabled: false }), providerRow(OTHER_PROVIDER)]
		});

		await expect(withdrawn.service.openSession(attempt() as never)).rejects.toThrow(
			/PAYMENT_PROVIDER_DISABLED/
		);

		const unknown = world();

		await expect(unknown.service.openSession(attempt({ providerId: 'nope' }) as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(
			unknown.service.openSession(attempt({ collectionId: 'nope' }) as never)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(withdrawn.tables.payment_session).toEqual([]);
		expect(unknown.tables.payment_session).toEqual([]);
	});
});

describe('PaymentSessionService — the split may reach the collection amount and not pass it (doc 10 §8.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts live attempts that sum to exactly the collection amount', async () => {
		// 60 + 40 = 100 is the split doc 10 §8.4 describes: several providers, one collection.
		const fixture = world();

		await fixture.service.openSession(attempt({ providerId: PROVIDER, amount: '60' }) as never);
		await fixture.service.openSession(attempt({ providerId: OTHER_PROVIDER, amount: '40' }) as never);

		expect(fixture.liveSessions().map((session) => session.amount)).toEqual(['60', '40']);
	});

	it('refuses one cent more than the collection amount', async () => {
		const fixture = world();

		await fixture.service.openSession(attempt({ providerId: PROVIDER, amount: '99.99' }) as never);

		await expect(
			fixture.service.openSession(attempt({ providerId: OTHER_PROVIDER, amount: '0.02' }) as never)
		).rejects.toThrow(/PAYMENT_COLLECTION_MISMATCH/);
		expect(fixture.liveSessions()).toHaveLength(1);
	});

	it('stops counting an attempt once it has reached a terminal status', async () => {
		// A failed attempt frees the `(collection, provider)` pair and releases what it held, so the next
		// attempt may use the whole collection amount again (doc 10 §8.11, "The failed session is closed
		// first").
		const fixture = world();

		const first = await fixture.service.openSession(attempt({ amount: '100' }) as never);

		await fixture.service.failSession(first.id);

		const retry = await fixture.service.openSession(attempt({ amount: '100' }) as never);

		expect(retry.status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.liveSessions().map((session) => session.id)).toEqual([retry.id]);
		expect(fixture.session(first.id).status).toBe(PaymentSessionStatus.ERROR);
	});

	// The defect: the capacity check runs *before* the previous live attempt of the same provider is
	// superseded, so a retry of a full-amount attempt is counted against its own predecessor and refused
	// with `PAYMENT_COLLECTION_MISMATCH` — the retry the class documentation describes ("a new attempt
	// for the same pair supersedes the previous one ... that is what makes a retry a retry rather than a
	// second charge") cannot be opened for the ordinary case of one provider collecting the whole
	// amount. (`payment-session.service.ts`, the `await this.assertCollectionCapacity(...)` call in
	// `openSession`, line 111, which precedes the `await this.findActiveSession(...)` on line 114 and the
	// supersede on line 123; doc 10 §8.11 "The failed session is closed first".)
	it.failing('[DEFECT] supersedes a live attempt of the whole amount instead of counting it twice', async () => {
		const fixture = world();

		const first = await fixture.service.openSession(attempt({ amount: '100' }) as never);
		const retry = await fixture.service.openSession(attempt({ amount: '100' }) as never);

		expect(retry.status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.session(first.id)).toMatchObject({
			status: PaymentSessionStatus.CANCELED,
			metadata: { superseded: true, supersededBy: retry.id }
		});
		expect(fixture.liveSessions().map((session) => session.id)).toEqual([retry.id]);
	});

	it('supersedes a live attempt of the same provider while the amounts leave room', async () => {
		// Control for the case above: the supersede itself works, and what it writes is the history an
		// operator reads — the previous attempt is kept, cancelled, and pointing at its successor.
		const fixture = world();

		const first = await fixture.service.openSession(attempt({ amount: '40' }) as never);
		const retry = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		expect(retry.status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.session(first.id)).toMatchObject({ status: PaymentSessionStatus.CANCELED });
		expect(fixture.session(first.id).metadata).toMatchObject({ superseded: true, supersededBy: retry.id });
		expect(fixture.liveSessions()).toHaveLength(1);
	});

	it('refuses to supersede an attempt that already reserved money', async () => {
		// The money an AUTHORIZED attempt reserved is real, so it is never replaced by a new attempt
		// (doc 10 §8.4).
		const fixture = world({
			sessions: [sessionRow('authorised', { amount: '40', status: PaymentSessionStatus.AUTHORIZED })]
		});

		await expect(fixture.service.openSession(attempt({ amount: '10' }) as never)).rejects.toThrow(
			/already has an authorised session/
		);
		expect(fixture.session('authorised').status).toBe(PaymentSessionStatus.AUTHORIZED);
		expect(fixture.tables.payment_session).toHaveLength(1);
	});
});

describe('PaymentSessionService — the provider answers (doc 10 §8.5, §8.7, §8.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records an approval, reserves it on the collection and announces it once', async () => {
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		const authorised = await fixture.service.authorizeSession(opened.id, {
			data: { providerReference: 'auth_1' }
		} as never);

		expect(authorised).toMatchObject({ status: PaymentSessionStatus.AUTHORIZED });
		expect(authorised.authorizedAt).toBeInstanceOf(Date);
		expect(authorised.data).toMatchObject({ providerReference: 'auth_1' });
		expect(fixture.collection()).toMatchObject({
			authorizedAmount: '40',
			status: PaymentCollectionStatus.PARTIALLY_AUTHORIZED
		});

		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(PaymentAuthorizedEvent);
		expect(fixture.published[0]).toMatchObject({
			sessionId: opened.id,
			amount: '40',
			currency: 'USD',
			collectionId: COLLECTION,
			organizationId: ORG
		});
	});

	it('refuses an attempt that is past its lifetime, one that is already closed, and one already captured', async () => {
		const past = world({
			sessions: [sessionRow('late', { expiresAt: new Date(Date.now() - 60_000) })]
		});

		await expect(past.service.authorizeSession('late')).rejects.toThrow(/PAYMENT_SESSION_EXPIRED/);

		const closed = world({
			sessions: [sessionRow('closed', { status: PaymentSessionStatus.CANCELED })]
		});

		await expect(closed.service.authorizeSession('closed')).rejects.toThrow(/PAYMENT_SESSION_ALREADY_CLOSED/);

		const captured = world({
			sessions: [sessionRow('captured', { status: PaymentSessionStatus.CAPTURED })]
		});

		await expect(captured.service.authorizeSession('captured')).rejects.toThrow(/PAYMENT_ALREADY_CAPTURED/);
		expect(past.published).toEqual([]);
		expect(closed.published).toEqual([]);
		expect(captured.collection()).toMatchObject({ authorizedAmount: '0' });
	});

	it('records a next action asked of a stored instrument as a decline', async () => {
		// Doc 10 §8.11 step 5 / I-29: there is nobody to perform the action, so a session that would be
		// parked in REQUIRES_MORE is refused instead.
		const fixture = world();
		const opened = await fixture.service.openSession(
			attempt({ amount: '10', paymentMethodTokenId: 'token-1' }) as never
		);

		await expect(
			fixture.service.authorizeSession(opened.id, { status: PaymentSessionStatus.REQUIRES_MORE } as never)
		).rejects.toThrow(/PAYMENT_AUTHORIZATION_FAILED/);
		expect(fixture.session(opened.id).status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.collection()).toMatchObject({ authorizedAmount: '0' });
	});

	it('refuses an approval that would take the collection past its amount', async () => {
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		await fixture.collectionService.recordAuthorization(COLLECTION, '100');

		await expect(fixture.service.authorizeSession(opened.id)).rejects.toThrow(
			/PAYMENT_AMOUNT_EXCEEDS_AUTHORIZED/
		);
		expect(fixture.session(opened.id).status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.collection().authorizedAmount).toBe('100');
	});

	// The defect: a repeated delivery of the same provider answer counts the authorisation again.
	// `authorizeSession` refuses only what is EXPIRED, CAPTURED or terminal, and `AUTHORIZED` is none of
	// those, so a second call re-writes the status, raises the collection's `authorizedAmount` by the
	// attempt's amount a second time and publishes a second `payment.authorized`. The collection is then
	// authorised for twice what the provider approved, which is exactly the drift the derived status
	// exists to prevent (`payment-session.service.ts`, `authorizeSession`, the terminal guard on lines
	// 239–249 and the `recordAuthorization` call on line 269). Doc 10 §8.8 scopes the authorisation to
	// `sessionId` and requires the stored authorisation result to be returned on a replay; doc 10 §8.5
	// has no `AUTHORIZED -> AUTHORIZED` transition.
	it.failing('[DEFECT] counts one authorisation once, however often the provider answer is delivered', async () => {
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		await fixture.service.authorizeSession(opened.id);
		await fixture.service.authorizeSession(opened.id);

		expect(fixture.collection().authorizedAmount).toBe('40');
		expect(fixture.published).toHaveLength(1);
	});

	it('records a refusal, frees the pair for a retry and announces the reason', async () => {
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		const failed = await fixture.service.failSession(opened.id, 'CARD_DECLINED');

		expect(failed).toMatchObject({
			status: PaymentSessionStatus.ERROR,
			metadata: { lastError: 'CARD_DECLINED' }
		});
		// Nothing was reserved, so the collection is only marked for what it is: an attempt that failed.
		expect(fixture.collection()).toMatchObject({
			status: PaymentCollectionStatus.FAILED,
			authorizedAmount: '0'
		});
		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(PaymentFailedEvent);
		expect(fixture.published[0]).toMatchObject({
			sessionId: opened.id,
			collectionId: COLLECTION,
			amount: '40',
			reason: 'CARD_DECLINED'
		});
	});

	it('refuses to fail an attempt that has already reached a terminal status', async () => {
		const fixture = world({
			sessions: [sessionRow('done', { status: PaymentSessionStatus.CAPTURED })]
		});

		await expect(fixture.service.failSession('done')).rejects.toThrow(/PAYMENT_SESSION_ALREADY_CLOSED/);
		expect(fixture.session('done').status).toBe(PaymentSessionStatus.CAPTURED);
		expect(fixture.published).toEqual([]);
	});
});

describe('PaymentSessionService — voiding an attempt (doc 10 §8.5, §13.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('releases the authorisation an attempt held and announces the amount released', async () => {
		// The attempt is the whole collection, so releasing it releases the whole authorisation and the
		// collection's derived state is the released one.
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '100' }) as never);

		await fixture.service.authorizeSession(opened.id);
		fixture.published.length = 0;

		const voided = await fixture.service.voidSession(opened.id, { reason: 'operator' });

		expect(voided).toMatchObject({
			status: PaymentSessionStatus.CANCELED,
			metadata: { reason: 'operator' }
		});
		expect(fixture.collection()).toMatchObject({
			authorizedAmount: '100',
			canceledAmount: '100',
			status: PaymentCollectionStatus.CANCELED
		});
		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(PaymentCanceledEvent);
		expect(fixture.published[0]).toMatchObject({ sessionId: opened.id, amount: '100', currency: 'USD' });
	});

	it('leaves a partial release as a partial release, and refuses a release past what is outstanding', async () => {
		// Control: the amounts are cumulative, so releasing one attempt of a collection that still has money
		// authorised elsewhere does not cancel the collection — and a release may not pass what is left.
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		await fixture.service.authorizeSession(opened.id);
		await fixture.service.voidSession(opened.id);

		expect(fixture.collection()).toMatchObject({
			authorizedAmount: '40',
			canceledAmount: '40',
			status: PaymentCollectionStatus.PARTIALLY_AUTHORIZED
		});
		await expect(fixture.collectionService.recordCancellation(COLLECTION, '0.01')).rejects.toThrow(
			/PAYMENT_CANCEL_EXCEEDS_AUTHORIZED/
		);
	});

	it('releases nothing when the attempt never reached the provider', async () => {
		// Cancelling an attempt that holds no authorisation is not a movement: the release is zero and the
		// collection's amounts stay where they were.
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		const voided = await fixture.service.voidSession(opened.id);

		expect(voided.status).toBe(PaymentSessionStatus.CANCELED);
		expect(fixture.collection()).toMatchObject({ authorizedAmount: '0', canceledAmount: '0' });
		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toMatchObject({ amount: '0' });
	});

	it('refuses to void an attempt that is already closed', async () => {
		const fixture = world({
			sessions: [sessionRow('expired', { status: PaymentSessionStatus.EXPIRED })]
		});

		await expect(fixture.service.voidSession('expired')).rejects.toThrow(/PAYMENT_SESSION_ALREADY_CLOSED/);
		expect(fixture.published).toEqual([]);
	});

	it('updates the descriptive fields of a live attempt and none of the fields that mean something', async () => {
		// The status, the amount and the provider move through the operations that mean something, so a
		// body that carries them is stripped rather than written.
		const fixture = world();
		const opened = await fixture.service.openSession(attempt({ amount: '40' }) as never);

		const updated = await fixture.service.updateSession(opened.id, {
			status: PaymentSessionStatus.CAPTURED,
			amount: '1',
			currency: 'EUR',
			providerId: OTHER_PROVIDER,
			collectionId: OTHER_COLLECTION,
			metadata: { note: 'buyer asked for a receipt' }
		} as never);

		expect(updated).toMatchObject({
			status: PaymentSessionStatus.PENDING,
			amount: '40',
			currency: 'USD',
			providerId: PROVIDER,
			collectionId: COLLECTION,
			metadata: { note: 'buyer asked for a receipt' }
		});
	});

	it('refuses to update an attempt that is already closed', async () => {
		const fixture = world({
			sessions: [sessionRow('done', { status: PaymentSessionStatus.ERROR })]
		});

		await expect(fixture.service.updateSession('done', { metadata: {} } as never)).rejects.toThrow(
			/PAYMENT_SESSION_ALREADY_CLOSED/
		);
	});
});

describe('PaymentSessionService — the expiry sweep (doc 10 §8.5)', () => {
	const AT = new Date('2026-04-01T12:00:00.000Z');

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('expires an attempt one millisecond past its lifetime and leaves the one that is exactly due', async () => {
		// The boundary doc 10 §8.5 states: a session "past their `expiresAt`" is expired, so the instant it
		// is due is still its own.
		const fixture = world({
			sessions: [
				sessionRow('exactly-due', { expiresAt: AT }),
				sessionRow('one-millisecond-late', { expiresAt: new Date(AT.getTime() - 1) }),
				sessionRow('still-open', { expiresAt: new Date(AT.getTime() + 1) })
			]
		});

		const expired = await fixture.service.expireOverdueSessions(AT);

		expect(expired.map((session) => session.id)).toEqual(['one-millisecond-late']);
		expect(fixture.session('exactly-due').status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.session('still-open').status).toBe(PaymentSessionStatus.PENDING);
		expect(fixture.session('one-millisecond-late').status).toBe(PaymentSessionStatus.EXPIRED);
	});

	it('sweeps only the statuses that are waiting, never one that reserved money', async () => {
		const past = new Date(AT.getTime() - 60_000);
		const fixture = world({
			sessions: [
				sessionRow('pending', { expiresAt: past, status: PaymentSessionStatus.PENDING }),
				sessionRow('submitted', { expiresAt: past, status: PaymentSessionStatus.PENDING_AUTHORIZATION }),
				sessionRow('more', { expiresAt: past, status: PaymentSessionStatus.REQUIRES_MORE }),
				sessionRow('authorised', { expiresAt: past, status: PaymentSessionStatus.AUTHORIZED }),
				sessionRow('captured', { expiresAt: past, status: PaymentSessionStatus.CAPTURED })
			]
		});

		const expired = await fixture.service.expireOverdueSessions(AT);

		expect(expired.map((session) => session.id).sort()).toEqual(['more', 'pending', 'submitted']);
		expect(fixture.session('authorised').status).toBe(PaymentSessionStatus.AUTHORIZED);
		expect(fixture.session('captured').status).toBe(PaymentSessionStatus.CAPTURED);
	});

	it('announces a timeout once per swept attempt and marks the collection', async () => {
		const past = new Date(AT.getTime() - 60_000);
		const fixture = world({
			sessions: [
				sessionRow('one', { expiresAt: past }),
				sessionRow('two', { collectionId: OTHER_COLLECTION, providerId: OTHER_PROVIDER, expiresAt: past })
			]
		});

		await fixture.service.expireOverdueSessions(AT);

		expect(fixture.published).toHaveLength(2);
		expect(fixture.published[0]).toBeInstanceOf(PaymentFailedEvent);
		expect(fixture.published.map((event) => event.reason)).toEqual([
			'PAYMENT_SESSION_EXPIRED',
			'PAYMENT_SESSION_EXPIRED'
		]);
		expect(fixture.collection(COLLECTION)).toMatchObject({ status: PaymentCollectionStatus.FAILED });
		expect(fixture.collection(OTHER_COLLECTION)).toMatchObject({ status: PaymentCollectionStatus.FAILED });
	});

	it('closes a late attempt on a refresh and leaves one that holds an authorisation alone', async () => {
		// The refresh reads the wall clock rather than an instant the caller states, so the fixture states
		// an expiry that is behind it.
		const past = new Date(Date.now() - 60_000);
		const fixture = world({
			sessions: [
				sessionRow('late', { expiresAt: past }),
				sessionRow('authorised', { expiresAt: past, status: PaymentSessionStatus.AUTHORIZED })
			]
		});

		expect(await fixture.service.refreshSession('late')).toMatchObject({
			status: PaymentSessionStatus.EXPIRED
		});
		expect(await fixture.service.refreshSession('authorised')).toMatchObject({
			status: PaymentSessionStatus.AUTHORIZED
		});
	});

	it('reports another organization’s attempt as missing, and paginates only the caller’s', async () => {
		const fixture = world({
			sessions: [
				sessionRow('mine'),
				sessionRow(OTHER_SESSION, { organizationId: OTHER_ORG })
			]
		});

		await expect(fixture.service.findSessionOrFail(OTHER_SESSION)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.voidSession(OTHER_SESSION)).rejects.toBeInstanceOf(NotFoundException);

		const page = await fixture.service.findSessions();

		expect(page.total).toBe(1);
		expect(page.items[0].id).toBe('mine');
	});
});
