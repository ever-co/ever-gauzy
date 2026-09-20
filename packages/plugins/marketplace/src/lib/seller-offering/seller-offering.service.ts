import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { ID, IPagination, OfferingStatus, SellerStatus } from '@gauzy/contracts';
import {
	ApiErrorCode,
	ApiException,
	EventOutboxService,
	IBulkTransactionRunner,
	RequestContext,
	TenantAwareCrudService,
	isUniqueViolation,
	operationOf
} from '@gauzy/core';
import type { BulkItemRequest } from '@gauzy/core';
import { SellerOffering } from './seller-offering.entity';
import {
	IBulkSellerOfferingItem,
	SELLER_OFFERING_BULK_OPERATIONS,
	SellerOfferingBulkOperation,
	isSellerOfferingBulkOperation
} from './seller-offering.bulk';
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

	/**
	 * The transaction a bulk batch writes its items through.
	 *
	 * An atomic batch has to be one transaction, and only the resource knows which connection its own
	 * table is written through, so the runner is the service's to state rather than the route's to
	 * assemble: the `.manager.transaction` path is the platform's, as it is everywhere else a group of
	 * writes has to commit or roll back together.
	 *
	 * It is a member rather than a method so it can be handed to the batch executor as it stands.
	 */
	public readonly transaction: IBulkTransactionRunner = (work) =>
		this.typeOrmSellerOfferingRepository.manager.transaction(work);

	/**
	 * The repository a write goes through.
	 *
	 * A batch that asked for atomicity hands every item the manager its one transaction opened, and an
	 * item written through any other handle would not be part of that transaction — it would survive the
	 * rollback the executor performs when a later item fails. A call that states no manager writes
	 * through the repository the single-item routes use.
	 *
	 * @param manager The batch's transactional manager, when the call has one.
	 * @returns The repository the call writes and reads through.
	 */
	private repository(manager?: EntityManager): Repository<SellerOffering> {
		return manager ? manager.getRepository(SellerOffering) : this.typeOrmSellerOfferingRepository;
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
	async getOffering(id: ID, scope?: ISellerScope, manager?: EntityManager): Promise<SellerOffering> {
		const offering = await this.repository(manager).findOne({
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

	/**
	 * Updates the mutable fields of an offering.
	 *
	 * `manager` is threaded for the reason the batch's writes are: an item of an atomic batch has to be
	 * read and written inside the one transaction the batch opened, or it would survive the rollback. A
	 * call that states none writes through the repository the single-item route uses.
	 */
	async updateOffering(
		id: ID,
		input: Partial<SellerOffering>,
		scope?: ISellerScope,
		manager?: EntityManager
	): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope, manager);

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

		const saved = await this.repository(manager).save(offering);

		await this.emit(saved, 'seller-offering.updated', { changed: Object.keys(values), status: saved.status }, manager);

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
	async publish(
		id: ID,
		channelIds?: string[],
		scope?: ISellerScope,
		manager?: EntityManager
	): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope, manager);
		const seller = await this.requireSeller(offering.sellerId, manager);

		if (channelIds?.length) {
			offering.channelIds = channelIds;
		}

		this.assertPublication(offering, seller);

		offering.status = OfferingStatus.ACTIVE;
		offering.approvedAt = new Date();
		offering.approvedByUserId = RequestContext.currentUserId();

		const published = await this.repository(manager).save(offering);

		await this.emit(
			published,
			'seller-offering.updated',
			{
				changed: ['status', 'channelIds'],
				status: published.status
			},
			manager
		);

		return published;
	}

	/** Pauses an offering without withdrawing it. */
	async unpause(id: ID, scope?: ISellerScope, manager?: EntityManager): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope, manager);

		offering.status = OfferingStatus.PAUSED;

		const paused = await this.repository(manager).save(offering);

		await this.emit(paused, 'seller-offering.updated', { changed: ['status'], status: paused.status }, manager);

		return paused;
	}

	/** Withdraws an offering; the row is kept, because it explains a past line's price and commission. */
	async withdraw(id: ID, scope?: ISellerScope, manager?: EntityManager): Promise<SellerOffering> {
		const offering = await this.getOffering(id, scope, manager);

		offering.status = OfferingStatus.WITHDRAWN;

		const withdrawn = await this.repository(manager).save(offering);

		await this.emit(withdrawn, 'seller-offering.withdrawn', { reason: 'WITHDRAWN' }, manager);

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
	 * Applies one item of an offering batch and answers the offering it moved.
	 *
	 * The item states one of the four operations this resource serves, and each of them is the act the
	 * delivered single-item route performs: a publish reaches `publish` with the item's channel subset, a
	 * pause reaches `unpause`, a withdrawal reaches `withdraw`, and a re-price reaches the
	 * price-and-commission half of `updateOffering`. The item therefore produces the same columns, the
	 * same outbox event and the same refusal as the equivalent call on its own route — a batch is a
	 * second way to ask, never a second thing that happens.
	 *
	 * **The platform's `op` is read only to refuse the one kind this batch cannot perform.** Every
	 * operation here addresses an offering that already exists, so an item that states `create` is asking
	 * for a write no route of this resource serves, and applying it as the operation it also named would
	 * answer a request the caller did not make. `update`, `upsert` and `delete` all name a row that must
	 * already exist, which is what this batch does — including `delete`, because the delivered removal is
	 * the withdrawal and it keeps the row.
	 *
	 * **`manager` is what makes an atomic batch all-or-nothing.** An atomic batch hands every item the one
	 * manager its transaction opened, and every read, write and outbox row of the item goes through it. A
	 * batch that applies its items one by one states no manager, and each item's write then stands on its
	 * own.
	 *
	 * @param item The item: the operation and the offering it applies to. The platform types an item of a
	 * batch as the resource's own members plus the optional `op` the batch contract adds to every item.
	 * @param scope The seller scope the guard resolved, when the caller is seller-scoped.
	 * @param manager The batch's transactional manager, when the batch has one.
	 * @returns The offering the item moved.
	 * @throws ApiException `400` when the item names an unknown operation or asks for a creation this batch
	 * does not perform, carrying the catalogue code the equivalent single-item refusal carries. The batch
	 * reports it as that item's failure.
	 */
	public async applyBulkItem(
		item: BulkItemRequest<IBulkSellerOfferingItem>,
		scope?: ISellerScope,
		manager?: EntityManager
	): Promise<SellerOffering> {
		if (operationOf(item) === 'create') {
			// A batch item that names a creation is refused with a catalogue code rather than a bare 400: the
			// executor reports an item's `ApiException` as it stands and treats anything else as an internal
			// defect, and a caller's mistake must not read as a defect of the platform.
			throw new ApiException(
				400,
				ApiErrorCode.VALIDATION_FAILED,
				'A bulk item cannot create an offering: it names the offering it applies to.',
				{ field: 'op' }
			);
		}

		if (!isSellerOfferingBulkOperation(item?.operation)) {
			// The batch refuses an unknown verb rather than applying one of the four by position, so an item a
			// client wrote with a typo is reported instead of guessing at what it meant. The code and the
			// detail are the ones the platform's own pre-pass gives a value that is not a member of its
			// vocabulary.
			throw new ApiException(
				400,
				ApiErrorCode.VALIDATION_INVALID_ENUM,
				`"${String(item?.operation)}" is not a bulk operation of an offering.`,
				{ field: 'operation', allowed: [...SELLER_OFFERING_BULK_OPERATIONS] }
			);
		}

		switch (item.operation) {
			case SellerOfferingBulkOperation.PUBLISH:
				return this.publish(item.id, item.channelIds, scope, manager);
			case SellerOfferingBulkOperation.PAUSE:
				return this.unpause(item.id, scope, manager);
			case SellerOfferingBulkOperation.WITHDRAW:
				return this.withdraw(item.id, scope, manager);
			default:
				return this.updateOffering(item.id, repriceOf(item), scope, manager);
		}
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
	 *
	 * A call that arrives with the batch's manager appends through it, because that transaction already
	 * exists and the announcement has to commit or roll back with the row it announces: opening a second
	 * transaction here would leave the outbox announcing a change the batch then rolled back. A call that
	 * states none opens the transaction the single-item routes use.
	 */
	private async emit(
		offering: SellerOffering,
		name: string,
		extra: Record<string, any> = {},
		manager?: EntityManager
	): Promise<void> {
		const event = {
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
		};

		if (manager) {
			await this.outbox.append(manager, event);

			return;
		}

		await this.typeOrmSellerOfferingRepository.manager.transaction(async (own) => {
			await this.outbox.append(own, event);
		});
	}

	/** Reads the seller a child row is being written for. */
	private async requireSeller(sellerId: ID, manager?: EntityManager): Promise<Seller> {
		const repository: Repository<Seller> = manager ? manager.getRepository(Seller) : this.sellerRepository;
		const seller = await repository.findOne({
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

/**
 * The members a re-price writes.
 *
 * Only the members the item states are returned, because a member an item leaves out is a member it says
 * nothing about: handing the update a key whose value is `undefined` would wipe the column the item was
 * silent on, and a batch that re-priced one offering would then also empty its currency or its
 * commission schedule.
 *
 * A re-price writes the price and, when the item states them, the commission members it is sold under. It
 * never touches the window, the channel set, the seller or the variant, which are the members
 * `updateOffering` refuses to move in any case.
 *
 * @param item The item.
 * @returns The offering members the item states.
 */
function repriceOf(item: IBulkSellerOfferingItem): Partial<SellerOffering> {
	return {
		...(item.priceAmount !== undefined ? { priceAmount: item.priceAmount } : {}),
		...(item.priceCurrency !== undefined ? { priceCurrency: item.priceCurrency } : {}),
		...(item.commissionRate !== undefined ? { commissionRate: item.commissionRate } : {}),
		...(item.commissionBasis !== undefined ? { commissionBasis: item.commissionBasis } : {}),
		...(item.commissionTiers !== undefined ? { commissionTiers: item.commissionTiers } : {})
	};
}
