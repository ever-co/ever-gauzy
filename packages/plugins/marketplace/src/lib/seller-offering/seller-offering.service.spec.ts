/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an offering service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**: only the base classes, the request context and the
 * entity mappings are substituted.
 *
 * `@gauzy/config` is read at import time by other packages of the workspace, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}
	}

	return {
		// `@UsePipes(new AbstractValidationPipe(…))` runs when the controller class is defined, and Nest
		// refuses a pipe without `transform`; the double carries both so the suite can load.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		TenantAwareCrudService,
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The decimal comparison the commission bands and the settlement's discrepancy are decided by is
		// the kernel's own, so the double hands over the real one: a comparison doubled here would agree
		// with the service about arithmetic the platform never performs.
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		// The batch path reads the operation an item declared and names a catalogue code when it refuses one,
		// so the kernel's own reader and its own error classes answer rather than a second copy of either.
		operationOf: jest.requireActual('@gauzy/core/src/lib/api/bulk').operationOf,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		Merchant: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		User: class {},
		Warehouse: class {},
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

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommissionBasis, OfferingStatus, SellerStatus } from '@gauzy/contracts';
import { ApiErrorCode, ApiException, RequestContext } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { SellerOffering } from './seller-offering.entity';
import { SellerOfferingService } from './seller-offering.service';
import { SellerOfferingBulkOperation } from './seller-offering.bulk';

/**
 * What a seller offers, and when it may be sold (doc 20 §3, §10.2).
 *
 * The specification fixes two rules and this suite pins both:
 *
 * - **`(seller, variant)` is unique among live offerings** (MK-5, §3.3): a seller offers a variant
 *   once while a variant may be offered by many sellers, and a second offer is a conflict rather
 *   than a duplicate listing;
 * - **publication is a conjunction and every clause is checked separately** (§3.4, MK-4), so a
 *   refusal names the clause that failed instead of answering "not available";
 * - **the availability window's edges are instants** (§3.4): the offering is available at the
 *   instant it opens and is no longer available at the instant it closes;
 * - **the organization is copied from the seller the service read, never from the request body**
 *   (§2.6), because a child row that could name another organization is the leak the invariant
 *   exists for;
 * - **a lapsed payout verification does not stop a sale** (§3.4): a seller whose bank verification
 *   expired keeps selling and stops being paid.
 *
 * The service is constructed directly with in-memory doubles of its repositories.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const SELLER = 'seller-1';
const VARIANT = 'variant-1';
const CHANNEL = 'channel-1';

type Row = Record<string, any>;

const sellerRow = (overrides: Row = {}) => ({
	id: SELLER,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'SELLER-1',
	contactId: 'contact-1',
	status: SellerStatus.ACTIVE,
	channelIds: null,
	...overrides
});

const offeringRow = (id: string, overrides: Row = {}) => ({
	id,
	sellerId: SELLER,
	variantId: VARIANT,
	tenantId: TENANT,
	organizationId: ORG,
	status: OfferingStatus.DRAFT,
	priceAmount: '10.00',
	priceCurrency: 'EUR',
	channelIds: null,
	regionIds: null,
	availableFrom: null,
	availableTo: null,
	...overrides
});

/**
 * Builds the offering service over in-memory tables.
 *
 * @param seed What the fixture holds.
 * @param options.failCreateWith What the write should throw, to model a unique violation.
 */
function offeringFixture(
	seed: { sellers?: Row[]; offerings?: Row[] } = {},
	options: { failCreateWith?: any } = {}
) {
	let sequence = 0;
	const tables = {
		seller: [...(seed.sellers ?? [sellerRow()])],
		seller_offering: [...(seed.offerings ?? [offeringRow('offering-1')])]
	};
	const appended: any[] = [];
	const appendedWith: unknown[] = [];

	const tableOf = (entity: unknown): Row[] => {
		if (entity === Seller) {
			return tables.seller;
		}

		if (entity === SellerOffering) {
			return tables.seller_offering;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			if (expected === null) {
				return row[field] === null || row[field] === undefined;
			}

			return String(row[field] ?? '') === String(expected);
		});

	const manager: any = {
		save: async (entity: unknown, row: Row) => {
			if (options.failCreateWith) {
				throw options.failCreateWith;
			}

			const table = tableOf(entity);
			const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}

			if (!row.id) {
				row.id = `generated-${++sequence}`;
			}

			table.push(row);

			return row;
		},
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager),
		// The repositories a batch's manager hands out. They read and write the same in-memory tables, which
		// is what makes the manager's transaction the only thing the batch's atomicity can be observed on:
		// a write that went through the repository instead would still land in these tables.
		getRepository: (entity: unknown) => ({
			findOne: async ({ where }: any = {}) => tableOf(entity).find((row) => matches(row, where)) ?? null,
			save: async (row: Row) => await manager.save(entity, row)
		})
	};

	const offeringRepository: any = {
		manager,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => await manager.save(SellerOffering, row),
		findOne: async ({ where }: any = {}) => tables.seller_offering.find((row) => matches(row, where)) ?? null,
		findAndCount: async ({ where }: any = {}) => {
			const found = tables.seller_offering.filter((row) => matches(row, where));

			return [found, found.length];
		}
	};
	const sellerRepository: any = {
		findOne: async ({ where }: any = {}) => tables.seller.find((row) => matches(row, where)) ?? null
	};
	const outbox = {
		append: async (manager: unknown, event: any) => {
			appended.push(event);
			appendedWith.push(manager);

			return event;
		}
	};

	const service = new SellerOfferingService(offeringRepository, {} as never, sellerRepository, outbox as never);

	return {
		service,
		manager,
		tables,
		appended,
		appendedWith,
		events: () => appended.map((event) => event.name),
		store: (id: string = 'offering-1') => tables.seller_offering.find((row) => row.id === id)
	};
}

describe('SellerOfferingService — authoring an offering (doc 20 §3.2, §3.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the offering in DRAFT with the seller’s own organization and tenant', async () => {
		// "The organization is copied from the seller the service read, never from the request body" (§2.6).
		const fixture = offeringFixture({ offerings: [] });

		const created = await fixture.service.createOffering({
			sellerId: SELLER,
			variantId: VARIANT,
			priceAmount: '12.50',
			priceCurrency: 'EUR',
			organizationId: OTHER_ORG,
			tenantId: 'another-tenant'
		} as never);

		expect(created).toMatchObject({
			status: OfferingStatus.DRAFT,
			organizationId: ORG,
			tenantId: TENANT,
			priceAmount: '12.50'
		});
		expect(fixture.events()).toEqual(['seller_offering.created']);
	});

	it('refuses an offering with no seller or no variant', async () => {
		const fixture = offeringFixture({ offerings: [] });

		await expect(fixture.service.createOffering({ variantId: VARIANT } as never)).rejects.toThrow(
			/needs a seller and a variant/
		);
		await expect(fixture.service.createOffering({ sellerId: SELLER } as never)).rejects.toThrow(BadRequestException);
		expect(fixture.tables.seller_offering).toEqual([]);
	});

	it('answers a second offer of one variant by one seller with a conflict', async () => {
		// MK-5: `(sellerId, variantId)` is unique among live offerings.
		const fixture = offeringFixture({ offerings: [] }, { failCreateWith: Object.assign(new Error('duplicate'), { code: '23505' }) });

		await expect(
			fixture.service.createOffering({ sellerId: SELLER, variantId: VARIANT, priceAmount: '10.00', priceCurrency: 'EUR' } as never)
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('refuses a window that ends before it starts, and one that ends when it starts', async () => {
		const fixture = offeringFixture({ offerings: [] });
		const from = new Date('2026-01-01T00:00:00.000Z');

		await expect(
			fixture.service.createOffering({
				sellerId: SELLER,
				variantId: VARIANT,
				priceAmount: '10.00',
				priceCurrency: 'EUR',
				availableFrom: from,
				availableTo: new Date(from.getTime() - 1)
			} as never)
		).rejects.toThrow(/window must end after it starts/);
		await expect(
			fixture.service.createOffering({
				sellerId: SELLER,
				variantId: VARIANT,
				priceAmount: '10.00',
				priceCurrency: 'EUR',
				availableFrom: from,
				availableTo: from
			} as never)
		).rejects.toThrow(BadRequestException);
	});

	it('refuses an authored price with no currency, which could not be resolved later', async () => {
		const fixture = offeringFixture({ offerings: [] });

		await expect(
			fixture.service.createOffering({ sellerId: SELLER, variantId: VARIANT, priceAmount: '10.00' } as never)
		).rejects.toThrow(/authored price needs a currency/);
	});

	it('refuses to author an offering for a seller that does not exist', async () => {
		const fixture = offeringFixture({ sellers: [], offerings: [] });

		await expect(
			fixture.service.createOffering({ sellerId: SELLER, variantId: VARIANT, priceAmount: '10.00', priceCurrency: 'EUR' } as never)
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('SellerOfferingService — editing an offering (doc 20 §13.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the mutable fields and ignores the ones that identify the row', async () => {
		const fixture = offeringFixture();

		const updated = await fixture.service.updateOffering('offering-1', {
			priceAmount: '11.00',
			sellerId: 'another-seller',
			variantId: 'another-variant',
			organizationId: OTHER_ORG,
			tenantId: 'another-tenant'
		} as never);

		expect(updated).toMatchObject({
			priceAmount: '11.00',
			sellerId: SELLER,
			variantId: VARIANT,
			organizationId: ORG,
			tenantId: TENANT
		});
	});

	it('re-validates the window against what the offering already holds', async () => {
		const fixture = offeringFixture({
			offerings: [offeringRow('offering-1', { availableFrom: new Date('2026-06-01T00:00:00.000Z') })]
		});

		await expect(
			fixture.service.updateOffering('offering-1', { availableTo: new Date('2026-01-01T00:00:00.000Z') } as never)
		).rejects.toThrow(/window must end after it starts/);
	});

	it('refuses an update to an offering that is not the caller’s', async () => {
		const fixture = offeringFixture({ offerings: [offeringRow('offering-1', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.updateOffering('offering-1', { priceAmount: '1.00' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
});

describe('SellerOfferingService — the state moves (doc 20 §3.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('submits a draft and a paused offering, and refuses to submit anything else', async () => {
		const draft = offeringFixture();
		const paused = offeringFixture({ offerings: [offeringRow('offering-1', { status: OfferingStatus.PAUSED })] });
		const active = offeringFixture({ offerings: [offeringRow('offering-1', { status: OfferingStatus.ACTIVE })] });

		expect((await draft.service.submit('offering-1')).status).toBe(OfferingStatus.PENDING_REVIEW);
		expect((await paused.service.submit('offering-1')).status).toBe(OfferingStatus.PENDING_REVIEW);
		await expect(active.service.submit('offering-1')).rejects.toBeInstanceOf(ConflictException);
	});

	it('publishes an offering of an active seller and records who approved it', async () => {
		const fixture = offeringFixture();

		const published = await fixture.service.publish('offering-1', [CHANNEL]);

		expect(published).toMatchObject({ status: OfferingStatus.ACTIVE, approvedByUserId: 'user-1' });
		expect(published.approvedAt).toBeInstanceOf(Date);
		expect(published.channelIds).toEqual([CHANNEL]);
	});

	it('refuses to publish an offering whose seller is not active', async () => {
		const fixture = offeringFixture({ sellers: [sellerRow({ status: SellerStatus.SUSPENDED })] });

		await expect(fixture.service.publish('offering-1')).rejects.toBeInstanceOf(ForbiddenException);
		expect(fixture.store()?.status).toBe(OfferingStatus.DRAFT);
	});

	it('refuses to publish an offering whose availability window has already closed', async () => {
		const fixture = offeringFixture({
			offerings: [offeringRow('offering-1', { availableTo: new Date(Date.now() - 1000) })]
		});

		await expect(fixture.service.publish('offering-1')).rejects.toThrow(/window of this offering has already closed/);
		expect(fixture.store()?.status).toBe(OfferingStatus.DRAFT);
	});

	it('pauses without withdrawing, and withdraws without destroying the row', async () => {
		// "the row is kept, because it explains a past line's price and commission" (§13.2).
		const fixture = offeringFixture();

		const paused = await fixture.service.unpause('offering-1');

		expect(paused.status).toBe(OfferingStatus.PAUSED);

		const withdrawn = await fixture.service.withdraw('offering-1');

		expect(withdrawn.status).toBe(OfferingStatus.WITHDRAWN);
		expect(fixture.tables.seller_offering).toHaveLength(1);
		expect(fixture.events()).toEqual(['seller_offering.updated', 'seller_offering.withdrawn']);
	});

	it('replaces the publication sets, leaving each one alone when the caller does not state it', async () => {
		const fixture = offeringFixture({
			offerings: [offeringRow('offering-1', { channelIds: ['channel-1'], regionIds: ['region-1'] })]
		});

		const updated = await fixture.service.setChannelSets('offering-1', { regionIds: ['region-2'] });

		expect(updated.channelIds).toEqual(['channel-1']);
		expect(updated.regionIds).toEqual(['region-2']);
	});
});

describe('SellerOfferingService — the publication clauses (MK-4, doc 20 §3.4)', () => {
	const active = { ...sellerRow() };

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers null for an offering that may be sold right now', () => {
		const fixture = offeringFixture();

		expect(fixture.service.blockedBy({ ...offeringRow('o'), status: OfferingStatus.ACTIVE } as never, active as never)).toBeNull();
	});

	it.each([
		['the seller is not active', { seller: { ...active, status: SellerStatus.SUSPENDED }, offering: { status: OfferingStatus.ACTIVE } }, 'SELLER_NOT_ACTIVE'],
		['the offering is not active', { seller: active, offering: { status: OfferingStatus.PAUSED } }, 'OFFERING_NOT_ACTIVE']
	])('names the clause that blocks a sale when %s', (_label, state, clause) => {
		// "a refusal names the clause that failed instead of answering 'not available'".
		const fixture = offeringFixture();

		expect(
			fixture.service.blockedBy(
				{ ...offeringRow('o'), ...state.offering } as never,
				state.seller as never
			)
		).toBe(clause);
	});

	it('is available at the instant its window opens and no longer available at the instant it closes', () => {
		// The window's edges are instants (§3.4): one bound is inclusive and the other is not, which is
		// what the two comparisons in the service state.
		const fixture = offeringFixture();
		const from = new Date('2026-06-01T00:00:00.000Z');
		const to = new Date('2026-07-01T00:00:00.000Z');
		const offering = { ...offeringRow('o'), status: OfferingStatus.ACTIVE, availableFrom: from, availableTo: to };

		expect(fixture.service.blockedBy(offering as never, active as never, undefined, from)).toBeNull();
		expect(fixture.service.blockedBy(offering as never, active as never, undefined, to)).toBe('NO_LONGER_AVAILABLE');
		expect(
			fixture.service.blockedBy(offering as never, active as never, undefined, new Date(from.getTime() - 1))
		).toBe('NOT_YET_AVAILABLE');
		expect(
			fixture.service.blockedBy(offering as never, active as never, undefined, new Date(to.getTime() - 1))
		).toBeNull();
	});

	it('blocks a channel the offering is not published to, and admits one it is', () => {
		const fixture = offeringFixture();
		const offering = { ...offeringRow('o'), status: OfferingStatus.ACTIVE, channelIds: ['channel-1'] };

		expect(fixture.service.blockedBy(offering as never, active as never, 'channel-2')).toBe('CHANNEL_NOT_PUBLISHED');
		expect(fixture.service.blockedBy(offering as never, active as never, CHANNEL)).toBeNull();
	});

	it('inherits the seller’s channels, and the whole organization’s when neither states any', () => {
		// "Publication is opt-in and additive: an offering with no channel set inherits the seller's, and a
		// seller with neither is available on every channel of the organization" (§3.4).
		const fixture = offeringFixture();
		const offering = { ...offeringRow('o'), channelIds: [] } as never;

		expect(fixture.service.effectiveChannels(offering, { ...active, channelIds: ['channel-1'] } as never, ['channel-9'])).toEqual([
			'channel-1'
		]);
		expect(fixture.service.effectiveChannels(offering, { ...active, channelIds: [] } as never, ['channel-9'])).toEqual([
			'channel-9'
		]);
		// An offering published to a channel subset never inherits anything: the subset is the answer.
		expect(
			fixture.service.effectiveChannels(
				{ ...offeringRow('o'), channelIds: ['channel-2'] } as never,
				{ ...active, channelIds: ['channel-1'] } as never,
				['channel-9']
			)
		).toEqual(['channel-2']);
	});

	it('keeps a seller with a lapsed payout verification selling', () => {
		// "A lapsed payout verification is deliberately *not* a blocking clause: a seller whose bank
		// verification expired keeps selling and stops being paid until it is renewed" (§3.4).
		const fixture = offeringFixture();
		const offering = { ...offeringRow('o'), status: OfferingStatus.ACTIVE };

		expect(
			fixture.service.blockedBy(
				offering as never,
				{ ...active, payoutAccountStatus: 'EXPIRED' } as never,
				undefined,
				new Date()
			)
		).toBeNull();
	});
});

describe('SellerOfferingService — what a scoped caller may see (MK-22, doc 20 §9.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a scoped caller that names another seller rather than silently narrowing', async () => {
		const fixture = offeringFixture();

		await expect(
			fixture.service.listOfferings({ where: { sellerId: 'another-seller' } }, { sellerId: SELLER, staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			fixture.service.getOffering('offering-1', { sellerId: 'another-seller', staff: false } as never)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('narrows an unnamed scoped list to the caller’s own offerings', async () => {
		const fixture = offeringFixture({
			offerings: [offeringRow('offering-1'), offeringRow('offering-2', { sellerId: 'seller-2' })]
		});

		const page = await fixture.service.listOfferings({}, { sellerId: SELLER, staff: false } as never);

		expect(page.items.map((row) => row.id)).toEqual(['offering-1']);
	});
});

describe('SellerOfferingService — one item of a batch (doc 20 §14.1, the bulk route)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('publishes through the publish route’s own act, channel subset and all', async () => {
		const fixture = offeringFixture();

		const moved = await fixture.service.applyBulkItem({
			id: 'offering-1',
			operation: SellerOfferingBulkOperation.PUBLISH,
			channelIds: [CHANNEL]
		});

		// Control: the item reaches the method the delivered route reaches, so the approval stamp and the
		// publication clauses are the ones that route applies — a batch that wrote the status directly would
		// leave `approvedAt` unset and would publish an offering whose seller is suspended.
		expect(moved).toMatchObject({
			status: OfferingStatus.ACTIVE,
			approvedByUserId: 'user-1',
			channelIds: [CHANNEL]
		});
		expect(moved.approvedAt).toBeInstanceOf(Date);
	});

	it('refuses to publish through the batch an offering whose seller is not active', async () => {
		const fixture = offeringFixture({ sellers: [sellerRow({ status: SellerStatus.SUSPENDED })] });

		await expect(
			fixture.service.applyBulkItem({ id: 'offering-1', operation: SellerOfferingBulkOperation.PUBLISH })
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(fixture.store()?.status).toBe(OfferingStatus.DRAFT);
	});

	it('pauses and withdraws through the two status moves, keeping the row', async () => {
		const paused = offeringFixture();

		await paused.service.applyBulkItem({ id: 'offering-1', operation: SellerOfferingBulkOperation.PAUSE });

		expect(paused.store()?.status).toBe(OfferingStatus.PAUSED);

		const withdrawn = offeringFixture();

		await withdrawn.service.applyBulkItem({ id: 'offering-1', operation: SellerOfferingBulkOperation.WITHDRAW });

		// "the row is kept, because it explains a past line's price and commission" (§13.2), and the event is
		// the withdrawal's own rather than the generic update.
		expect(withdrawn.store()?.status).toBe(OfferingStatus.WITHDRAWN);
		expect(withdrawn.tables.seller_offering).toHaveLength(1);
		expect(withdrawn.events()).toEqual(['seller_offering.withdrawn']);
	});

	it('re-prices the amount and leaves every member the item did not state as it was', async () => {
		const fixture = offeringFixture({
			offerings: [
				offeringRow('offering-1', {
					priceAmount: '10.00',
					priceCurrency: 'EUR',
					commissionRate: '0.150000',
					title: 'The seller’s own title'
				})
			]
		});

		await fixture.service.applyBulkItem({
			id: 'offering-1',
			operation: SellerOfferingBulkOperation.REPRICE,
			priceAmount: '19.00'
		});

		// Control: an item that states only the amount must not empty the columns it was silent on, which is
		// what an update carrying every member would do — and the currency is the one the offering already
		// held, so the price is resolvable.
		expect(fixture.store()).toMatchObject({
			priceAmount: '19.00',
			priceCurrency: 'EUR',
			commissionRate: '0.150000',
			title: 'The seller’s own title'
		});
		expect(fixture.events()).toEqual(['seller_offering.updated']);
	});

	it('re-prices the commission members when the item states them', async () => {
		const fixture = offeringFixture();

		await fixture.service.applyBulkItem({
			id: 'offering-1',
			operation: SellerOfferingBulkOperation.REPRICE,
			priceAmount: '19.00',
			priceCurrency: 'USD',
			commissionRate: '0.200000',
			commissionBasis: CommissionBasis.DISCOUNTED_SUBTOTAL
		});

		expect(fixture.store()).toMatchObject({
			priceCurrency: 'USD',
			commissionRate: '0.200000',
			commissionBasis: CommissionBasis.DISCOUNTED_SUBTOTAL
		});
	});

	it('refuses an authored price with no currency anywhere to resolve it', async () => {
		// The same refusal the edit route gives: the item states an amount and neither it nor the offering
		// holds a currency, so the price could not be resolved later.
		const fixture = offeringFixture({ offerings: [offeringRow('offering-1', { priceCurrency: null })] });

		await expect(
			fixture.service.applyBulkItem({
				id: 'offering-1',
				operation: SellerOfferingBulkOperation.REPRICE,
				priceAmount: '19.00'
			})
		).rejects.toThrow(/authored price needs a currency/);
		expect(fixture.store()?.priceAmount).toBe('10.00');
	});

	it('refuses an item that names no known operation, naming the ones it may state', async () => {
		const fixture = offeringFixture();

		const refusal = await fixture.service
			.applyBulkItem({ id: 'offering-1', operation: 'REPRICE_OFFERING' } as never)
			.catch((thrown) => thrown);

		// Control: the refusal carries the catalogue code and the vocabulary rather than a bare 400, because
		// the platform's executor reports an item's `ApiException` as it stands and treats anything else as an
		// internal defect — a caller's typo must not read as a defect of the platform.
		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.VALIDATION_INVALID_ENUM);
		expect(refusal.details).toEqual({
			field: 'operation',
			allowed: ['PUBLISH', 'PAUSE', 'WITHDRAW', 'REPRICE']
		});
		expect(fixture.events()).toEqual([]);
	});

	it('refuses an item that asks the batch to create an offering', async () => {
		const fixture = offeringFixture({ offerings: [] });

		const refusal = await fixture.service
			.applyBulkItem({ id: 'offering-1', op: 'create', operation: SellerOfferingBulkOperation.PUBLISH } as never)
			.catch((thrown) => thrown);

		// Control: no operation of this route creates a row, so an item that declares one is reported instead
		// of being applied as the operation it also named — and nothing was written.
		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.code).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(refusal.details).toEqual({ field: 'op' });
		expect(fixture.tables.seller_offering).toEqual([]);
	});

	it('refuses an item that addresses another seller’s offering', async () => {
		const fixture = offeringFixture({ offerings: [offeringRow('offering-1', { sellerId: 'seller-2' })] });

		await expect(
			fixture.service.applyBulkItem(
				{ id: 'offering-1', operation: SellerOfferingBulkOperation.PAUSE },
				{ sellerId: SELLER, staff: false } as never
			)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('writes the row and its event through the manager the batch’s transaction opened', async () => {
		const fixture = offeringFixture();
		const batchManager: any = {
			...fixture.manager,
			getRepository: jest.fn(fixture.manager.getRepository)
		};

		await fixture.service.applyBulkItem(
			{ id: 'offering-1', operation: SellerOfferingBulkOperation.PAUSE },
			undefined,
			batchManager
		);

		// Control: this is what makes an atomic batch all-or-nothing. An item read and written through the
		// repository the single-item routes use would not be part of the batch's transaction, and the event
		// would announce a change the executor's rollback then undid — so the manager is asserted on for both
		// the row and the outbox row.
		expect(batchManager.getRepository).toHaveBeenCalledWith(SellerOffering);
		expect(fixture.appendedWith).toEqual([batchManager]);
		expect(fixture.store()?.status).toBe(OfferingStatus.PAUSED);
	});

	it('opens the service’s own transaction for an item applied outside a batch', async () => {
		const fixture = offeringFixture();

		await fixture.service.applyBulkItem({ id: 'offering-1', operation: SellerOfferingBulkOperation.PAUSE });

		// A batch that is not atomic states no manager, and the item's write then stands on its own: the event
		// is written in the transaction the single-item routes use, which is the repository's own.
		expect(fixture.appendedWith).toEqual([fixture.manager]);
	});
});
