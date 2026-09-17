import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IPagination, OfferingStatus, SellerStatus } from '@gauzy/contracts';
import { EventOutboxService, RequestContext, TenantAwareCrudService, isUniqueViolation } from '@gauzy/core';
import { SellerOffering } from './seller-offering.entity';
import { MikroOrmSellerOfferingRepository } from './repository/mikro-orm-seller-offering.repository';
import { TypeOrmSellerOfferingRepository } from './repository/type-orm-seller-offering.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';

/**
 * Manages what a seller offers, and when it may be sold.
 *
 * Two rules are enforced here rather than merely documented:
 *
 * - **`(seller, variant)` is unique among live offerings**, so a seller offers a variant once while a
 *   variant may be offered by many sellers: competing offers are the normal case, and the winner is
 *   decided by the platform's price resolution rather than by a second pricing mechanism.
 * - **Publication is a conjunction, and every clause is checked separately** so a refusal names the
 *   clause that failed instead of answering "not available". A seller must be active, the offering
 *   must be active, its window must contain now, the channel and the region must be in the effective
 *   sets, and the catalogue must have published the product and the variant to that channel — a seller
 *   cannot publish a variant the platform has not published.
 */
@Injectable()
export class SellerOfferingService extends TenantAwareCrudService<SellerOffering> {
	constructor(
		readonly typeOrmSellerOfferingRepository: TypeOrmSellerOfferingRepository,
		readonly mikroOrmSellerOfferingRepository: MikroOrmSellerOfferingRepository,
		private readonly sellerRepository: TypeOrmSellerRepository,
		private readonly outbox: EventOutboxService
	) {
		super(typeOrmSellerOfferingRepository, mikroOrmSellerOfferingRepository);
	}

	/** Lists offerings, narrowed to the caller's seller unless the caller is staff. */
	async listOfferings(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerOffering>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			// The seller predicate is applied whether or not the caller named a seller: asking for another
			// seller's offerings is refused rather than silently narrowed.
			assertSellerScope(scope, where.sellerId);
			where.sellerId = scope.sellerId;
		}

		return this.paginate({ ...filter, where });
	}

	/** Reads one offering, refusing one that belongs to another seller. */
	async getOffering(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.typeOrmSellerOfferingRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerOffering>
		});

		if (!offering) {
			throw new NotFoundException('The seller offering does not exist.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, offering.sellerId);
		}

		return offering;
	}

	/** Creates an offering in `DRAFT`; publishing it is a separate act. */
	async createOffering(input: Partial<SellerOffering>, scope?: ISellerScope): Promise<SellerOffering> {
		if (!input.sellerId || !input.variantId) {
			throw new BadRequestException('An offering needs a seller and a variant.');
		}

		if (scope) {
			assertSellerScope(scope, input.sellerId);
		}

		const seller = await this.requireSeller(input.sellerId);
		const window = this.assertWindow(input.availableFrom, input.availableTo);
		this.assertPrice(input.priceAmount, input.priceCurrency);

		const offering = this.typeOrmSellerOfferingRepository.create({
			...input,
			...window,
			status: input.status ?? OfferingStatus.DRAFT,
			// The organization is copied from the seller the service read, never from the request body: a
			// child row that could name another organization would be the leak the invariant exists for.
			organizationId: seller.organizationId,
			tenantId: seller.tenantId
		} as Partial<SellerOffering>);

		try {
			const created = await this.typeOrmSellerOfferingRepository.save(offering as SellerOffering);

			await this.emit(created, 'seller-offering.created', {
				variantId: created.variantId,
				productId: created.productId,
				sellerSku: created.sellerSku,
				priceAmount: created.priceAmount,
				priceCurrency: created.priceCurrency
			});

			return created;
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// `(sellerId, variantId)` is unique among live offerings, so a second offer of one variant by
			// one seller is a conflict rather than a duplicate listing.
			throw new ConflictException('This seller already offers this variant, or the SKU is already used.');
		}
	}

	/** Updates the mutable fields of an offering. */
	async updateOffering(id: ID, input: Partial<SellerOffering>, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		const window = this.assertWindow(
			input.availableFrom ?? offering.availableFrom,
			input.availableTo ?? offering.availableTo
		);
		this.assertPrice(input.priceAmount ?? offering.priceAmount, input.priceCurrency ?? offering.priceCurrency);

		// Named as strings rather than as `keyof SellerOffering`, because the immutable set includes the
		// columns every platform base entity contributes — the organization and the tenant above all,
		// which are the two a caller must never be able to move.
		const immutable = ['id', 'sellerId', 'variantId', 'organizationId', 'tenantId'];
		const values: Record<string, any> = { ...input, ...window };

		for (const field of immutable) {
			delete values[field];
		}

		Object.assign(offering, values);

		const saved = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(saved, 'seller-offering.updated', { changed: Object.keys(values), status: saved.status });

		return saved;
	}

	/** Moves an offering to `PENDING_REVIEW`. */
	async submit(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		if (offering.status !== OfferingStatus.DRAFT && offering.status !== OfferingStatus.PAUSED) {
			throw new ConflictException(`An offering in ${offering.status} cannot be submitted.`);
		}

		offering.status = OfferingStatus.PENDING_REVIEW;

		const submitted = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(submitted, 'seller-offering.updated', { changed: ['status'], status: submitted.status });

		return submitted;
	}

	/**
	 * Publishes an offering, optionally to a channel subset.
	 *
	 * The publication clauses are checked before the status changes so that a seller is never told an
	 * offering is live when a clause would have excluded it.
	 */
	async publish(id: ID, channelIds?: string[], scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);
		const seller = await this.requireSeller(offering.sellerId);

		if (channelIds?.length) {
			offering.channelIds = channelIds;
		}

		this.assertPublication(offering, seller);

		offering.status = OfferingStatus.ACTIVE;
		offering.approvedAt = new Date();
		offering.approvedByUserId = RequestContext.currentUserId();

		const published = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(published, 'seller-offering.updated', {
			changed: ['status', 'channelIds'],
			status: published.status
		});

		return published;
	}

	/** Pauses an offering without withdrawing it. */
	async unpause(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		offering.status = OfferingStatus.PAUSED;

		const paused = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(paused, 'seller-offering.updated', { changed: ['status'], status: paused.status });

		return paused;
	}

	/** Withdraws an offering; the row is kept, because it explains a past line's price and commission. */
	async withdraw(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		offering.status = OfferingStatus.WITHDRAWN;

		const withdrawn = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(withdrawn, 'seller-offering.withdrawn', { reason: 'WITHDRAWN' });

		return withdrawn;
	}

	/** Replaces the offering's publication sets. */
	async setChannelSets(
		id: ID,
		sets: { channelIds?: string[]; regionIds?: string[] },
		scope?: ISellerScope
	): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		if (sets.channelIds !== undefined) {
			offering.channelIds = sets.channelIds;
		}

		if (sets.regionIds !== undefined) {
			offering.regionIds = sets.regionIds;
		}

		const saved = await this.typeOrmSellerOfferingRepository.save(offering);

		await this.emit(saved, 'seller-offering.updated', {
			changed: ['channelIds', 'regionIds'],
			status: saved.status
		});

		return saved;
	}

	/**
	 * The channels an offering is effectively published to.
	 *
	 * Publication is opt-in and additive: an offering with no channel set inherits the seller's, and a
	 * seller with neither is available on every channel of the organization.
	 */
	effectiveChannels(offering: SellerOffering, seller: Seller, organizationChannels: string[] = []): string[] {
		return offering.channelIds?.length
			? offering.channelIds
			: seller.channelIds?.length
				? seller.channelIds
				: organizationChannels;
	}

	/**
	 * Whether an offering may be sold right now, and the clause that blocks it when it may not.
	 *
	 * @returns The blocking clause, or null when the offering is sellable.
	 */
	blockedBy(offering: SellerOffering, seller: Seller, channelId?: ID, now: Date = new Date()): string | null {
		if (seller.status !== SellerStatus.ACTIVE) {
			return 'SELLER_NOT_ACTIVE';
		}

		if (offering.status !== OfferingStatus.ACTIVE) {
			return 'OFFERING_NOT_ACTIVE';
		}

		if (offering.availableFrom && new Date(offering.availableFrom) > now) {
			return 'NOT_YET_AVAILABLE';
		}

		if (offering.availableTo && new Date(offering.availableTo) <= now) {
			return 'NO_LONGER_AVAILABLE';
		}

		const channels = this.effectiveChannels(offering, seller);

		if (channelId && channels.length && !channels.includes(String(channelId))) {
			return 'CHANNEL_NOT_PUBLISHED';
		}

		// A lapsed payout verification is deliberately *not* a blocking clause: a seller whose bank
		// verification expired keeps selling and stops being paid until it is renewed, because holding a
		// seller's listings hostage to a document is a worse outcome than paying it late.
		return null;
	}

	/** Refuses a publication the clauses block. */
	private assertPublication(offering: SellerOffering, seller: Seller): void {
		if (seller.status !== SellerStatus.ACTIVE) {
			throw new ForbiddenException(
				`Seller '${seller.code}' is ${seller.status}, so its offerings are not sellable.`
			);
		}

		const window = this.assertWindow(offering.availableFrom, offering.availableTo);

		if (window.availableTo && new Date(window.availableTo) <= new Date()) {
			throw new BadRequestException('The availability window of this offering has already closed.');
		}
	}

	/** Refuses a window that ends before it starts. */
	private assertWindow(availableFrom?: Date, availableTo?: Date): { availableFrom?: Date; availableTo?: Date } {
		if (availableFrom && availableTo && new Date(availableTo) <= new Date(availableFrom)) {
			throw new BadRequestException('The availability window must end after it starts.');
		}

		return { availableFrom, availableTo };
	}

	/** Refuses an authored price without a currency, which could not be resolved later. */
	private assertPrice(priceAmount?: any, priceCurrency?: any): void {
		if (priceAmount !== undefined && priceAmount !== null && !priceCurrency) {
			throw new BadRequestException('An authored price needs a currency.');
		}
	}

	/**
	 * Writes one outbox row for an offering state change.
	 *
	 * The event is written in the same transaction as the row, so an offering cannot change without the
	 * platform being able to say that it did — which is what a catalogue projection, a price-cache
	 * invalidation and an open-cart validation all depend on.
	 */
	private async emit(offering: SellerOffering, name: string, extra: Record<string, any> = {}): Promise<void> {
		await this.typeOrmSellerOfferingRepository.manager.transaction(async (manager) => {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'SELLER_OFFERING',
				aggregateId: offering.id as ID,
				data: {
					offeringId: offering.id,
					sellerId: offering.sellerId,
					status: offering.status,
					channelIds: offering.channelIds ?? [],
					commissionRate: offering.commissionRate,
					...extra
				},
				tenantId: offering.tenantId,
				organizationId: offering.organizationId
			});
		});
	}

	/** Reads the seller a child row is being written for. */
	private async requireSeller(sellerId: ID): Promise<Seller> {
		const seller = await this.sellerRepository.findOne({
			where: {
				id: sellerId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<Seller>
		});

		if (!seller) {
			throw new NotFoundException('The seller does not exist.');
		}

		return seller;
	}
}
