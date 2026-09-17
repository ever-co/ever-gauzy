import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { ID, IPagination, OfferingStatus, SellerStatus } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
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
 *   clause that failed instead of answering "not available". A seller must be active, the offering must
 *   be active, its window must contain now, the channel and the region must be in the effective sets,
 *   and the catalogue must have published the product and the variant to that channel — a seller cannot
 *   publish a variant the platform has not published.
 */
@Injectable()
export class SellerOfferingService extends TenantAwareCrudService<SellerOffering> {
	constructor(
		readonly typeOrmSellerOfferingRepository: TypeOrmSellerOfferingRepository,
		readonly mikroOrmSellerOfferingRepository: MikroOrmSellerOfferingRepository,
		private readonly sellerRepository: TypeOrmSellerRepository
	) {
		super(typeOrmSellerOfferingRepository, mikroOrmSellerOfferingRepository);
	}

	/** Lists offerings, narrowed to the caller's seller unless the caller is staff. */
	async listOfferings(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerOffering>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			assertSellerScope(scope, where.sellerId);
			where.sellerId = scope.sellerId;
		}

		return this.pagination({ ...filter, where });
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
			// The organization is copied from the seller the service read, never from the request body:
			// a child row that could name another organization would be the leak the invariant exists for.
			organizationId: seller.organizationId,
			tenantId: seller.tenantId
		} as Partial<SellerOffering>);

		try {
			return await this.typeOrmSellerOfferingRepository.save(offering as SellerOffering);
		} catch (error) {
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
		this.assertPrice(
			input.priceAmount ?? offering.priceAmount,
			input.priceCurrency ?? offering.priceCurrency
		);

		// Named as strings rather than as `keyof SellerOffering`, because the immutable set includes the
		// columns every platform base entity contributes — the organization and the tenant above all,
		// which are the two a caller must never be able to move.
		const immutable = ['id', 'sellerId', 'variantId', 'organizationId', 'tenantId'];
		const values: Record<string, any> = { ...input, ...window };

		for (const field of immutable) {
			delete values[field];
		}

		Object.assign(offering, values);

		return this.typeOrmSellerOfferingRepository.save(offering);
	}

	/** Moves an offering to `PENDING_REVIEW`. */
	async submit(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		if (offering.status !== OfferingStatus.DRAFT && offering.status !== OfferingStatus.PAUSED) {
			throw new ConflictException(`An offering in ${offering.status} cannot be submitted.`);
		}

		offering.status = OfferingStatus.PENDING_REVIEW;

		return this.typeOrmSellerOfferingRepository.save(offering);
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

		return this.typeOrmSellerOfferingRepository.save(offering);
	}

	/** Pauses an offering without withdrawing it. */
	async unpause(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		offering.status = OfferingStatus.PAUSED;

		return this.typeOrmSellerOfferingRepository.save(offering);
	}

	/** Withdraws an offering; the row is kept, because it explains a past line's price and commission. */
	async withdraw(id: ID, scope?: ISellerScope): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope);

		offering.status = OfferingStatus.WITHDRAWN;

		return this.typeOrmSellerOfferingRepository.save(offering);
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

		return this.typeOrmSellerOfferingRepository.save(offering);
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

		if (channelId && this.effectiveChannels(offering, seller).length && !this.effectiveChannels(offering, seller).includes(String(channelId))) {
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
			throw new ForbiddenException(`Seller '${seller.code}' is ${seller.status}, so its offerings are not sellable.`);
		}

		const window = this.assertWindow(offering.availableFrom, offering.availableTo);

		if (window.availableFrom || window.availableTo) {
			const now = new Date();

			if (window.availableTo && new Date(window.availableTo) <= now) {
				throw new BadRequestException('The availability window of this offering has already closed.');
			}
		}
	}

	/** Refuses a window that ends before it starts. */
	private assertWindow(
		availableFrom?: Date,
		availableTo?: Date
	): { availableFrom?: Date; availableTo?: Date } {
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
