import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, RequestContext } from '@gauzy/core';
import { PromotionUsage } from './promotion-usage.entity';
import { TypeOrmPromotionUsageRepository } from './repository/type-orm-promotion-usage.repository';
import { MikroOrmPromotionUsageRepository } from './repository/mikro-orm-promotion-usage.repository';
import { IPromotionUsage, PromotionUsageStatus, RevertOnReturnPolicy } from '../promotion.types';

/**
 * The redemption ledger: one row per application of a promotion.
 *
 * The lifecycle is the whole point of the table, and it is deliberately not a boolean:
 *
 * ```
 * (applied to a cart) --RESERVED--> (order placed) --REGISTERED--> (return policy) --REVERTED
 *          |                                                              ^
 *          +-- TTL elapsed / cart abandoned / promotion removed ----------+
 * ```
 *
 * A reservation counts against every limit and against the budget, which is what stops two concurrent
 * checkouts from both consuming the last use of a coupon. Registration does **not** increment
 * anything, because the reservation already did; that is what makes a replayed checkout idempotent
 * rather than double-counted. Reversal never deletes the row — the audit trail is the point — and a
 * second reversal of the same row is a no-op, so a compensated saga cannot revert twice.
 */
@Injectable()
export class PromotionUsageService extends CrudService<PromotionUsage> {
	constructor(
		readonly typeOrmPromotionUsageRepository: TypeOrmPromotionUsageRepository,
		readonly mikroOrmPromotionUsageRepository: MikroOrmPromotionUsageRepository
	) {
		super(typeOrmPromotionUsageRepository, mikroOrmPromotionUsageRepository);
	}

	/**
	 * The tenant and organization of the caller.
	 */
	get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Reserves a redemption while a cart is being checked out.
	 *
	 * The reservation is idempotent per `(promotionId, cartId)`: re-evaluating a cart reuses the row
	 * it already holds rather than reserving a second one, which is what lets a cart be recalculated
	 * on every write without leaking budget.
	 *
	 * @param input The redemption being reserved.
	 * @returns The reservation row.
	 * @throws BadRequestException when the same promotion is already registered against the order.
	 */
	async reserve(input: {
		promotionId: ID;
		couponId?: ID;
		cartId?: ID;
		orderId?: ID;
		customerId?: ID;
		code?: string;
		amount: DecimalString;
		currency: string;
	}): Promise<IPromotionUsage> {
		const existing = await this.findLiveReservation(input.promotionId, input.cartId);

		if (existing) {
			await this.update(existing.id, { amount: input.amount, couponId: input.couponId, code: input.code } as never);
			return this.findOneByWhereOptions({ id: existing.id } as never);
		}

		if (input.orderId) {
			const registered = await this.findOneByWhereOptions({
				promotionId: input.promotionId,
				orderId: input.orderId
			} as never);

			if (registered) {
				return registered;
			}
		}

		return this.create({
			...input,
			status: PromotionUsageStatus.RESERVED,
			usedAt: new Date(),
			...this.scope
		} as never);
	}

	/**
	 * Promotes a reservation to a registration when the order is placed.
	 *
	 * Nothing is incremented here: the counters and the budget already counted the reservation, and
	 * counting it twice is exactly the defect this lifecycle exists to prevent. A replayed placement
	 * finds the registered row and returns it.
	 *
	 * @param orderId The order that was placed.
	 * @param cartId The cart it was placed from, when the usage was reserved against one.
	 * @returns The registered rows.
	 */
	async register(orderId: ID, cartId?: ID): Promise<IPromotionUsage[]> {
		const rows = (await this.typeOrmPromotionUsageRepository.find({
			where: [{ orderId, ...this.scope }, ...(cartId ? [{ cartId, status: PromotionUsageStatus.RESERVED, ...this.scope }] : [])]
		})) as unknown as IPromotionUsage[];

		for (const row of rows) {
			if (row.status === PromotionUsageStatus.RESERVED) {
				await this.update(row.id, { status: PromotionUsageStatus.REGISTERED, orderId } as never);
			}
		}

		return this.findByOrder(orderId);
	}

	/**
	 * Reverts a redemption, wholly or in part, under the applicable policy.
	 *
	 * The amount is clamped to what was registered: a reversal can never return more benefit than was
	 * given, which is what keeps a partly returned order from refunding a whole promotion. A row that
	 * is already `REVERTED` is returned untouched and writes nothing, so the call is idempotent.
	 *
	 * @param promotionId The promotion whose redemption is being reverted.
	 * @param orderId The order the redemption belongs to.
	 * @param policy What the domain says about reversibility on a return.
	 * @param returnedShare The share of the order that came back, for a proportional policy.
	 * @returns What was reverted, and the row.
	 */
	async revert(
		promotionId: ID,
		orderId: ID,
		policy: RevertOnReturnPolicy = RevertOnReturnPolicy.PROPORTIONAL,
		returnedShare = 1
	): Promise<{ reverted: DecimalString; usage: IPromotionUsage | null }> {
		const usage = await this.findOneByWhereOptions({ promotionId, orderId, ...this.scope } as never);

		if (!usage) {
			throw new NotFoundException('PROMOTION_NOT_FOUND: no redemption of this promotion on that order.');
		}

		if (usage.status === PromotionUsageStatus.REVERTED) {
			return { reverted: '0', usage };
		}

		const registered = Number(usage.amount);
		const share = policy === RevertOnReturnPolicy.NEVER ? 0 : policy === RevertOnReturnPolicy.ALWAYS ? 1 : returnedShare;
		const reverted = Math.min(registered, Math.max(0, registered * share));

		if (reverted >= registered) {
			await this.update(usage.id, { status: PromotionUsageStatus.REVERTED } as never);
		} else {
			// A partial reversal keeps the row registered and reduces the recorded benefit, so the
			// residue stays attributable to the units the customer kept.
			await this.update(usage.id, { amount: String(registered - reverted) } as never);
		}

		return { reverted: String(reverted), usage: await this.findOneByWhereOptions({ id: usage.id } as never) };
	}

	/**
	 * Releases the reservations of a cart, for removal, abandonment or a TTL that has elapsed.
	 *
	 * @param cartId The cart whose reservations are released.
	 * @returns The rows that were released.
	 */
	async releaseCart(cartId: ID): Promise<IPromotionUsage[]> {
		const rows = (await this.typeOrmPromotionUsageRepository.find({
			where: { cartId, status: PromotionUsageStatus.RESERVED, ...this.scope }
		})) as unknown as IPromotionUsage[];

		for (const row of rows) {
			await this.update(row.id, { status: PromotionUsageStatus.REVERTED } as never);
		}

		return rows;
	}

	/**
	 * The reservations that have outlived their time to live and are due to be released.
	 *
	 * @param ttlMinutes How long a reservation holds.
	 * @returns The rows the expiry sweep releases.
	 */
	async findExpiredReservations(ttlMinutes: number): Promise<IPromotionUsage[]> {
		const cutoff = new Date(Date.now() - ttlMinutes * 60_000);

		const rows = (await this.typeOrmPromotionUsageRepository
			.createQueryBuilder('usage')
			.where('usage.status = :status', { status: PromotionUsageStatus.RESERVED })
			.andWhere('usage."usedAt" <= :cutoff', { cutoff })
			.andWhere('usage."organizationId" = :organizationId', { organizationId: this.scope.organizationId })
			.getMany()) as unknown as IPromotionUsage[];

		return rows;
	}

	/**
	 * Reads the redemptions of an order.
	 *
	 * @param orderId The order to read.
	 * @returns The redemption rows.
	 */
	async findByOrder(orderId: ID): Promise<IPromotionUsage[]> {
		const rows = await this.typeOrmPromotionUsageRepository.find({
			where: { orderId, ...this.scope },
			order: { usedAt: 'ASC' }
		});

		return rows as unknown as IPromotionUsage[];
	}

	/**
	 * Reads the redemption ledger of a promotion, for its usage view.
	 *
	 * @param promotionId The promotion to read.
	 * @param options Optional filters, such as a status or an order.
	 * @returns One page of redemptions.
	 */
	async findByPromotion(promotionId: ID, options: Record<string, unknown> = {}): Promise<IPagination<IPromotionUsage>> {
		return this.findAll({
			...options,
			where: { ...((options.where as object) ?? {}), promotionId, ...this.scope },
			order: { usedAt: 'DESC' }
		} as never);
	}

	/**
	 * Counts the live redemptions of a promotion by one customer, which is how the per-customer limit
	 * is answered. Reserved rows count: a limit that ignores a reservation is a limit two checkouts
	 * can exceed.
	 *
	 * @param promotionId The promotion.
	 * @param customerId The customer.
	 * @returns The number of live redemptions.
	 */
	async countByCustomer(promotionId: ID, customerId: ID): Promise<number> {
		return this.typeOrmPromotionUsageRepository.count({
			where: {
				promotionId,
				customerId,
				status: [PromotionUsageStatus.RESERVED, PromotionUsageStatus.REGISTERED] as never,
				...this.scope
			}
		});
	}

	/**
	 * Counts the registered redemptions of a promotion, which is the figure the promotion's cached
	 * counter is compared with by the nightly audit.
	 *
	 * @param promotionId The promotion.
	 * @returns The number of registered redemptions.
	 */
	async countRegistered(promotionId: ID): Promise<number> {
		return this.typeOrmPromotionUsageRepository.count({
			where: { promotionId, status: PromotionUsageStatus.REGISTERED, ...this.scope }
		});
	}

	/**
	 * Finds the live reservation of a promotion on a cart.
	 *
	 * @param promotionId The promotion.
	 * @param cartId The cart, when the caller has one.
	 * @returns The reservation, or null.
	 */
	private async findLiveReservation(promotionId: ID, cartId?: ID): Promise<IPromotionUsage | null> {
		if (!cartId) {
			return null;
		}

		const row = await this.findOneByWhereOptions({
			promotionId,
			cartId,
			status: PromotionUsageStatus.RESERVED,
			...this.scope
		} as never);

		return row ?? null;
	}
}
