/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the job
 * registry, the module scanner — none of which a callback log needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the services under test are the real ones**:
 * the intake service and the provider registry it resolves a callback through, over in-memory doubles of
 * their repositories. Only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors the platform's `CrudService` where the behaviour is observable to a
 * caller, and that includes the behaviour the first case at the bottom of this file is about:
 * `findOneByWhereOptions` raises `NotFoundException` for an absent row on both ORM branches
 * (`crud.service.ts`, lines 451–469) rather than answering the `null` its prose promises. `intake` asks
 * "have I seen this callback before?" through exactly that read, which is why the case matters here and
 * every other case is written against a path that does not depend on it.
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

			// Faithful to the platform: an absent row is a refusal, not a null.
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
import { RequestContext } from '@gauzy/core';
import { PaymentWebhookEventStatus } from '../payment.types';
import { PaymentProviderService } from '../payment-provider/payment-provider.service';
import { PaymentWebhookEventService } from './payment-webhook-event.service';

/**
 * The inbound provider callback log (doc 10 §8.9, doc 05 §12.7).
 *
 * The intake obeys one ordering rule and everything else follows from it: **the payload row is written
 * before anything else happens** — before the type is looked up, before any state changes. A callback
 * that cannot be verified is therefore still on record, which is what a dispute is argued with, and a
 * handler defect is replayable from the bytes that caused it rather than from a provider's dashboard
 * that forgets.
 *
 * On top of that ordering the suite pins four rules:
 *
 * - **replay protection is the unique `(providerId, eventId)` pair** (I-14). A provider that retries a
 *   callback it never got an answer for is acknowledged as a duplicate and nothing is processed twice,
 *   and the stored row is not rewritten by the retry;
 * - **`IGNORED` and `FAILED` are different answers, deliberately.** A validly signed event of a type the
 *   provider's own event map does not name is `IGNORED` — nothing to do — while `FAILED` is reserved for
 *   something to fix. Collapsing the two would bury a real handler defect under a provider's new feature;
 * - **no route accepts card data**, and the intake is a route like any other: a payload carrying a member
 *   named `number`, `pan`, `cvc`, `ivan`-style account data or a free-text expiry is refused with the
 *   documented code before the row is written;
 * - **a settled event is not re-applied without an explicit decision.** Re-processing an event that
 *   already succeeded is a money defect, so it takes `force` rather than a retry.
 *
 * The service is constructed directly with in-memory doubles of its repositories. The double states the
 * `where` the service states, so "nothing was written" is asserted against state rather than against a
 * mock's call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const PROVIDER = 'provider-1';
const OTHER_PROVIDER = 'provider-2';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	payment_webhook_event: Row[];
	payment_provider: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
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

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

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

/** One `payment_provider` row, with the event map its adapter declares. */
const providerRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id,
	name: `Provider ${id}`,
	isEnabled: true,
	isTestMode: false,
	sortOrder: 0,
	configuration: { eventMap: { 'payment_intent.succeeded': 'capture-payment' } },
	...overrides
});

/** One `payment_webhook_event` row, as the service reads it. */
const eventRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	providerId: PROVIDER,
	eventId: 'evt_1',
	type: 'payment_intent.succeeded',
	payload: { id: 'evt_1' },
	signature: 't=1,v1=abc',
	receivedAt: new Date('2026-01-01T00:00:00.000Z'),
	status: PaymentWebhookEventStatus.RECEIVED,
	attemptCount: 0,
	...overrides
});

/**
 * Builds the intake service over one in-memory datastore, composing the real provider registry over its
 * own double.
 *
 * @param options The rows the fixture starts with.
 */
function webhookFixture(options: { providers?: Row[]; events?: Row[] } = {}) {
	const tables: ITables = {
		payment_provider: options.providers ?? [
			providerRow(PROVIDER, { code: 'card-primary' }),
			providerRow(OTHER_PROVIDER, { code: 'card-secondary' })
		],
		payment_webhook_event: options.events ?? []
	};
	const providerService = new PaymentProviderService(repository(tables, 'payment_provider') as never, {} as never);
	const service = new PaymentWebhookEventService(
		repository(tables, 'payment_webhook_event') as never,
		{} as never,
		providerService
	);

	return {
		service,
		tables,
		event: (id: string) => tables.payment_webhook_event.find((row) => row.id === id)
	};
}

/** A callback to record, so a case states only what it is about. */
const callback = (overrides: Row = {}) => ({
	providerCode: 'card-primary',
	eventId: 'evt_1',
	type: 'payment_intent.succeeded',
	payload: { id: 'evt_1', amount: 4200 },
	signature: 't=1,v1=abc',
	...overrides
});

describe('PaymentWebhookEventService — what may never be stored (doc 10 §8.9, doc 06 §6.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['a card number by its common name', { number: '4242424242424242' }, 'number'],
		['a card number under a separator', { card_number: '4242424242424242' }, 'card_number'],
		['a primary account number', { pan: '4242424242424242' }, 'pan'],
		['a verification value', { cvc: '123' }, 'cvc'],
		['a second verification value', { cvv2: '123' }, 'cvv2'],
		['a bank account number', { accountNumber: 'DE89370400440532013000' }, 'accountNumber'],
		['an iban', { iban: 'DE89370400440532013000' }, 'iban'],
		['a free-text expiry', { expiry: '12/30' }, 'expiry'],
		['card data nested inside the body', { data: { card: { cvv: '123' } } }, 'data.card.cvv'],
		['card data inside a list', { charges: [{ pan: '4242424242424242' }] }, 'charges[0].pan']
	])('refuses %s before the row is written', async (_label, payload, member) => {
		// The platform stores a provider-issued token and no primary account number, no verification value
		// and no full account number, so the body is refused — as a refusal, never as a silent drop, so a
		// caller that tries to send one learns immediately that this platform cannot receive it.
		const fixture = webhookFixture();
		const quoted = String(member).replace(/[.[\]]/g, '\\$&');

		await expect(
			fixture.service.intake(callback({ payload: { id: 'evt_1', ...payload } }) as never)
		).rejects.toThrow(new RegExp(`PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED[^]*'${quoted}'`));
		expect(fixture.tables.payment_webhook_event).toEqual([]);
	});

	it('refuses a payload that is not an object, and one that carries no event identifier', async () => {
		const fixture = webhookFixture();

		await expect(fixture.service.intake(callback({ payload: 'a raw body' }) as never)).rejects.toThrow(
			/PAYMENT_WEBHOOK_PAYLOAD_INVALID/
		);
		await expect(fixture.service.intake(callback({ payload: ['a', 'list'] }) as never)).rejects.toThrow(
			/PAYMENT_WEBHOOK_PAYLOAD_INVALID/
		);
		await expect(fixture.service.intake(callback({ eventId: '   ' }) as never)).rejects.toThrow(
			/PAYMENT_WEBHOOK_PAYLOAD_INVALID/
		);
		await expect(fixture.service.intake(callback({ eventId: undefined }) as never)).rejects.toThrow(
			/PAYMENT_WEBHOOK_PAYLOAD_INVALID/
		);
		expect(fixture.tables.payment_webhook_event).toEqual([]);
	});

	it('reports a callback that names a provider this organization does not have as missing', async () => {
		const fixture = webhookFixture();

		await expect(fixture.service.intake(callback({ providerCode: 'no-such-provider' }) as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.intake(callback({ providerId: 'no-such-provider' }) as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.tables.payment_webhook_event).toEqual([]);
	});

	it('reads the replay pair inside the caller’s organization and nowhere else', async () => {
		// A provider code arrives on a public callback path, so the organization in context decides whose
		// registration — and therefore whose replay guard — a callback is resolved against (doc 10 §8.9
		// step 1).
		const fixture = webhookFixture({
			providers: [
				providerRow(PROVIDER, { code: 'card-primary' }),
				providerRow(OTHER_PROVIDER, { code: 'card-primary', organizationId: OTHER_ORG })
			],
			events: [eventRow('theirs', { providerId: OTHER_PROVIDER, organizationId: OTHER_ORG, eventId: 'evt_1' })]
		});

		// In this organization the pair has not been seen — and, per the `[DEFECT]` case at the bottom of
		// this file, an unseen pair is reported as a refusal rather than as a null.
		await expect(fixture.service.findByProviderAndEvent(PROVIDER, 'evt_1')).rejects.toBeInstanceOf(
			NotFoundException
		);

		// In the organization that owns the row, the same provider code and event id resolve to it, and the
		// callback is answered as that organization's duplicate.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		await expect(fixture.service.findByProviderAndEvent(OTHER_PROVIDER, 'evt_1')).resolves.toMatchObject({
			id: 'theirs'
		});
		expect((await fixture.service.intake(callback() as never)).duplicate).toBe(true);
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
	});
});

describe('PaymentWebhookEventService — the pairwise replay guard (I-14, doc 05 §12.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers a callback it has already recorded as a duplicate and stores nothing twice', async () => {
		const fixture = webhookFixture({
			events: [eventRow('stored', { eventId: 'evt_1', status: PaymentWebhookEventStatus.PROCESSED, attemptCount: 0 })]
		});

		const intake = await fixture.service.intake(callback({ payload: { id: 'evt_1', amount: 9999 } }) as never);

		expect(intake.duplicate).toBe(true);
		expect(intake.event).toMatchObject({ id: 'stored', status: PaymentWebhookEventStatus.PROCESSED });
		// The retry does not rewrite what was recorded: the row keeps the payload that was first seen and
		// the attempt count the handler left behind.
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
		expect(fixture.event('stored').payload).toEqual({ id: 'evt_1' });
		expect(fixture.event('stored').attemptCount).toBe(0);
	});

	it('answers a duplicate of a failed event as a duplicate too, instead of retrying it by intake', async () => {
		// A failed event is retried by the retry schedule, not by the provider's next delivery: the intake
		// acknowledges and does nothing.
		const fixture = webhookFixture({
			events: [
				eventRow('failed', {
					eventId: 'evt_1',
					status: PaymentWebhookEventStatus.FAILED,
					lastError: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
					attemptCount: 2
				})
			]
		});

		const intake = await fixture.service.intake(callback() as never);

		expect(intake.duplicate).toBe(true);
		expect(fixture.event('failed')).toMatchObject({
			status: PaymentWebhookEventStatus.FAILED,
			lastError: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
			attemptCount: 2
		});
	});

	it('never answers with another organization’s event', async () => {
		const fixture = webhookFixture({
			events: [eventRow('theirs', { organizationId: OTHER_ORG })]
		});

		// The pair exists — just not for this caller — so the read finds nothing here, and the row itself is
		// untouched by the attempt.
		await expect(fixture.service.findByProviderAndEvent(PROVIDER, 'evt_1')).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.event('theirs')).toMatchObject({
			organizationId: OTHER_ORG,
			status: PaymentWebhookEventStatus.RECEIVED,
			attemptCount: 0
		});
	});
});

describe('PaymentWebhookEventService — the type map decides between nothing to do and something to fix (doc 10 §8.9)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('leaves an event the provider’s map names where it is, for the named handler to settle', async () => {
		// The handler the map names applies the effect and settles the event through `markProcessed` or
		// `markFailed`; the classification claims no effect it did not apply.
		const fixture = webhookFixture({
			events: [eventRow('queued', { type: 'payment_intent.succeeded' })]
		});

		const reprocessed = await fixture.service.reprocess('queued');

		expect(reprocessed).toMatchObject({ id: 'queued', status: PaymentWebhookEventStatus.RECEIVED });
		expect(reprocessed.processedAt).toBeUndefined();
	});

	it.each([
		['a type the map does not name', { 'payment_intent.succeeded': 'capture-payment' }, 'charge.dispute.created'],
		['a map that is empty', {}, 'payment_intent.succeeded'],
		['a map whose entry is not a string', { 'payment_intent.succeeded': 42 }, 'payment_intent.succeeded'],
		['a map whose entry is blank', { 'payment_intent.succeeded': '   ' }, 'payment_intent.succeeded']
	])('ignores an event with %s', async (_label, eventMap, type) => {
		// `IGNORED` is a validly signed event of a type this build does not handle: there is nothing to do,
		// which is a different fact from a handler that broke.
		const fixture = webhookFixture({
			providers: [
				providerRow(PROVIDER, { configuration: { eventMap } }),
				providerRow(OTHER_PROVIDER, { code: 'card-secondary' })
			],
			events: [eventRow('odd', { type })]
		});

		const reprocessed = await fixture.service.reprocess('odd');

		expect(reprocessed).toMatchObject({ status: PaymentWebhookEventStatus.IGNORED });
		expect(reprocessed.processedAt).toBeInstanceOf(Date);
	});

	it('refuses to re-apply an event that already succeeded, unless the caller forces it', async () => {
		// Re-applying an effect that already landed is a money defect, so it takes an explicit decision
		// rather than a retry.
		const fixture = webhookFixture({
			events: [
				eventRow('done', {
					status: PaymentWebhookEventStatus.PROCESSED,
					processedAt: new Date('2026-01-01T00:05:00.000Z')
				})
			]
		});

		await expect(fixture.service.reprocess('done')).rejects.toThrow(/PAYMENT_WEBHOOK_ALREADY_PROCESSED/);
		expect(fixture.event('done')).toMatchObject({ status: PaymentWebhookEventStatus.PROCESSED });

		const forced = await fixture.service.reprocess('done', true);

		expect(forced).toMatchObject({ id: 'done', status: PaymentWebhookEventStatus.PROCESSED });
		expect(forced.processedAt).toEqual(new Date('2026-01-01T00:05:00.000Z'));
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
	});

	it('re-classifies an ignored event whose type the map has gained since, without writing a second row', async () => {
		const fixture = webhookFixture({
			events: [eventRow('ignored', { type: 'payment_intent.succeeded', status: PaymentWebhookEventStatus.IGNORED })]
		});

		const reprocessed = await fixture.service.reprocess('ignored');

		expect(reprocessed).toMatchObject({ id: 'ignored' });
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
	});

	it('reports an unknown event, and another organization’s event, as missing', async () => {
		const fixture = webhookFixture({ events: [eventRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findEventOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.reprocess('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.markProcessed('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PaymentWebhookEventService — the outcome of a processing attempt (doc 10 §8.9 step 5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records a handled event, and clears a failure it supersedes', async () => {
		const fixture = webhookFixture({
			events: [
				eventRow('retried', {
					status: PaymentWebhookEventStatus.FAILED,
					lastError: 'PAYMENT_WEBHOOK_HANDLER_FAILED',
					attemptCount: 1
				})
			]
		});

		const processed = await fixture.service.markProcessed('retried');

		expect(processed).toMatchObject({ status: PaymentWebhookEventStatus.PROCESSED });
		expect(processed.processedAt).toBeInstanceOf(Date);
		expect(processed.lastError).toBeNull();
	});

	it('counts every failed attempt and keeps the last error', async () => {
		// The count is what the retry schedule reads, and the error is what an operator reads: neither may
		// be overwritten by a later attempt that failed differently.
		const fixture = webhookFixture({ events: [eventRow('failing')] });

		await fixture.service.markFailed('failing', 'FIRST');
		await fixture.service.markFailed('failing', 'SECOND');

		expect(fixture.event('failing')).toMatchObject({
			status: PaymentWebhookEventStatus.FAILED,
			lastError: 'SECOND',
			attemptCount: 2
		});
	});

	it('keeps an unverified callback on record as evidence rather than dropping it', async () => {
		// The payload row was written before verification, so a callback whose signature did not verify is
		// still on record — which is what a dispute is argued with.
		const fixture = webhookFixture({ events: [eventRow('unsigned', { signature: 't=1,v1=forged' })] });

		const refused = await fixture.service.markSignatureInvalid('unsigned');

		expect(refused).toMatchObject({
			status: PaymentWebhookEventStatus.FAILED,
			lastError: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
			attemptCount: 1,
			signature: 't=1,v1=forged'
		});
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
		expect(fixture.event('unsigned').payload).toEqual({ id: 'evt_1' });
	});

	it('paginates the callback log of the caller’s organization, and only those', async () => {
		const fixture = webhookFixture({
			events: [
				eventRow('mine'),
				eventRow('also-mine', { eventId: 'evt_2' }),
				eventRow('theirs', { organizationId: OTHER_ORG })
			]
		});

		const page = await fixture.service.findEvents();

		expect(page.total).toBe(2);
		expect(page.items.map((row) => row.id).sort()).toEqual(['also-mine', 'mine']);
	});
});

/**
 * What the base class's throwing read costs.
 *
 * `intake` asks "have I seen this `(providerId, eventId)` before?" through `findByProviderAndEvent`,
 * which is `findOneByWhereOptions` — and that read raises `NotFoundException` when the row is absent
 * instead of answering `null`. The absence of a replay is therefore indistinguishable from a missing
 * record, and the row this whole service exists to write is never written.
 */
describe('PaymentWebhookEventService — the intake of a callback that has not been seen (doc 05 §12.7, I-53)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	// The defect: a first-time callback cannot be recorded at all, because the replay guard reads through
	// `findOneByWhereOptions` (`payment-webhook-event.service.ts`, the
	// `await this.findByProviderAndEvent(provider.id, eventId)` call in `intake`, line 84), which raises
	// `NotFoundException` for an absent row rather than answering null — so "not seen before" and "the
	// record is missing" are the same answer, and the payload-before-everything rule the class documents
	// is unreachable.
	it.failing('[DEFECT] writes the payload row before anything is done with it', async () => {
		const fixture = webhookFixture();
		const receivedAt = new Date('2026-02-01T12:00:00.000Z');

		const intake = await fixture.service.intake(callback({ receivedAt }) as never);

		expect(intake.duplicate).toBe(false);
		expect(fixture.tables.payment_webhook_event).toHaveLength(1);
		expect(intake.event).toMatchObject({
			providerId: PROVIDER,
			eventId: 'evt_1',
			type: 'payment_intent.succeeded',
			payload: { id: 'evt_1', amount: 4200 },
			signature: 't=1,v1=abc',
			status: PaymentWebhookEventStatus.RECEIVED,
			attemptCount: 0,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(intake.event.receivedAt).toEqual(receivedAt);
	});
});
