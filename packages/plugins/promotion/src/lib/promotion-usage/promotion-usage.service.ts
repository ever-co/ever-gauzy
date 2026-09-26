import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import {
	Money,
	RequestContext,
	compareDecimalStrings,
	normalizeDecimalString,
	subtractDecimalStrings
} from '@gauzy/core';
import { PromotionUsage } from './promotion-usage.entity';
import { TypeOrmPromotionUsageRepository } from './repository/type-orm-promotion-usage.repository';
import { MikroOrmPromotionUsageRepository } from './repository/mikro-orm-promotion-usage.repository';
import { IPromotionUsage, PromotionUsageStatus, RevertOnReturnPolicy } from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

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
 *
 * **The promotion's own cached counter is not maintained here.** `promotion.usageCount` belongs to the
 * promotion row, and the statement that moves it is `PromotionService.consume` — so the entry points a
 * checkout calls are `PromotionService.reserveUsage`, `revertUsage` and `releaseCartUsage`, each of
 * which writes this ledger and moves that counter as one step. Calling `reserve` here directly writes
 * the ledger and nothing else, which is exactly the half-write that made `usageLimit` unenforceable;
 * the counter is a cache of {@link countLive}, and `PromotionService.auditUsageCount` repairs it from
 * this table when the two have drifted.
 */
@Injectable()
export class PromotionUsageService extends TenantScopedCrudService<PromotionUsage> {
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
			// A redemption the order does not hold yet is the ordinary case for a first placement, so
			// the read answers with nothing rather than failing the reservation.
			const registered = await this.typeOrmPromotionUsageRepository.findOneBy({
				promotionId: input.promotionId,
				orderId: input.orderId,
				...this.scope
			});

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
		returnedShare: DecimalString | number = 1
	): Promise<{ reverted: DecimalString; usage: IPromotionUsage | null }> {
		const usage = await this.typeOrmPromotionUsageRepository.findOneBy({
			promotionId,
			orderId,
			...this.scope
		});

		if (!usage) {
			throw new NotFoundException('PROMOTION_NOT_FOUND: no redemption of this promotion on that order.');
		}

		if (usage.status === PromotionUsageStatus.REVERTED) {
			return { reverted: '0', usage };
		}

		const registered = Money.of(usage.amount, usage.currency);
		const share = this.clampedShare(policy, returnedShare);

		// A proportional reversal is an allocation of the registered amount rather than a multiplication
		// by a fraction: the two parts are whole minor units and sum back to the whole exactly, so the
		// share that goes back to the budget and the residual the customer keeps can never disagree by a
		// cent (doc 08 §14.2, F-22).
		//
		// **The residual is `1 - share` in exact decimal arithmetic, not in binary.** The weights go
		// through `normalizeDecimalString`, which reads a `number` by way of `String()` and refuses
		// anything that is not an exact decimal — so a near-total return of `0.9999999` produced a
		// residual of `1.0000000000287557e-7`, exponential notation, and a `PROPORTIONAL` revert threw
		// `MONEY_NOT_DECIMAL_STRING` out of the return path as a 500 instead of reversing anything. The
		// quieter half of the same defect: `1 - 0.07` is `0.9299999999999999` rather than `0.93`, which
		// skews the weights and lets the largest-remainder tiebreak hand the odd minor unit to the
		// wrong side.
		// The *weight*, not the amount: `residualPart.amount` below is what the customer keeps, and the
		// two are different numbers with the same idea behind them.
		const residualWeight = subtractDecimalStrings('1', share);
		const [revertedPart, residualPart] = registered.allocate([share, residualWeight]);
		const reverted = normalizeDecimalString(revertedPart.amount);
		const residual = normalizeDecimalString(residualPart.amount);

		if (revertedPart.equals(registered)) {
			await this.update(usage.id, { status: PromotionUsageStatus.REVERTED } as never);
		} else {
			// A partial reversal keeps the row registered and reduces the recorded benefit, so the
			// residue stays attributable to the units the customer kept.
			await this.update(usage.id, { amount: residual } as never);
		}

		return {
			reverted,
			usage: await this.typeOrmPromotionUsageRepository.findOneBy({ id: usage.id, ...this.scope })
		};
	}

	/**
	 * The share of a registered redemption a reversal returns, as an exact decimal between nothing and
	 * everything.
	 *
	 * The clamp is a comparison of decimals rather than `Math.min`/`Math.max` on doubles, for the same
	 * reason the residual is: the value becomes an allocation weight, and an allocation weight that is
	 * not an exact decimal is refused by the money layer rather than rounded by it. A caller that
	 * states nonsense — a negative share, a share above one, something that is not a number at all —
	 * gets the nearest legal share rather than an exception, because a reversal is a compensating
	 * action and failing one leaves the order's money in a state nobody asked for.
	 *
	 * @param policy What the domain says about reversibility on a return.
	 * @param returnedShare The share of the order that came back, for a proportional policy.
	 * @returns The share, in `[0, 1]`, as an exact decimal string.
	 */
	private clampedShare(policy: RevertOnReturnPolicy, returnedShare: DecimalString | number): DecimalString {
		if (policy === RevertOnReturnPolicy.NEVER) {
			return '0';
		}

		if (policy === RevertOnReturnPolicy.ALWAYS) {
			return '1';
		}

		let stated: DecimalString;

		try {
			stated = normalizeDecimalString(returnedShare as DecimalString);
		} catch {
			// A share that is not a decimal at all — a NaN, an infinity, a string from a caller that
			// computed it as a float and let `String()` render it exponentially — reverts nothing rather
			// than failing the return.
			return '0';
		}

		if (compareDecimalStrings(stated, '0') < 0) {
			return '0';
		}

		return compareDecimalStrings(stated, '1') > 0 ? '1' : stated;
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
			// The property form, not a quoted identifier: a raw fragment reaches the driver untouched,
			// and MySQL reads `"usedAt"` as the string `usedAt` rather than as the column.
			.andWhere('usage.usedAt <= :cutoff', { cutoff })
			.andWhere('usage.organizationId = :organizationId', { organizationId: this.scope.organizationId })
			// The tenant as well as the organization. Every other read in this service is scoped by
			// `this.scope`, which is both columns; scoping the sweep by one of them alone leaves it
			// matching a row of another tenant that happens to share an organization identifier, and a
			// sweep releases reservations.
			.andWhere('usage.tenantId = :tenantId', { tenantId: this.scope.tenantId })
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
	 * Reads the redemptions one coupon granted, for the coupon's own view.
	 *
	 * @param couponId The coupon to read.
	 * @returns The redemption rows, most recent first.
	 */
	async findByCoupon(couponId: ID): Promise<IPromotionUsage[]> {
		const rows = await this.typeOrmPromotionUsageRepository.find({
			where: { couponId, ...this.scope },
			order: { usedAt: 'DESC' }
		});

		return rows as unknown as IPromotionUsage[];
	}

	/**
	 * Paginates the redemption ledger of the caller's organization, optionally narrowed to one
	 * promotion, coupon, order, basket or customer.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of redemptions.
	 */
	async findUsages(options: Record<string, unknown> = {}): Promise<IPagination<IPromotionUsage>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
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
	 * Counts the live redemptions of a promotion: reserved as well as registered.
	 *
	 * This is what the cached `usageCount` is a cache *of*, and therefore what the audit repairs it
	 * from. A reservation counts, for the same reason it counts towards the per-customer limit: a
	 * ceiling that ignores reservations is a ceiling two concurrent checkouts can exceed.
	 *
	 * @param promotionId The promotion.
	 * @returns The number of live redemptions.
	 */
	async countLive(promotionId: ID): Promise<number> {
		return this.typeOrmPromotionUsageRepository.count({
			where: {
				promotionId,
				status: [PromotionUsageStatus.RESERVED, PromotionUsageStatus.REGISTERED] as never,
				...this.scope
			}
		});
	}

	/**
	 * Whether a cart already holds a live reservation of a promotion.
	 *
	 * The caller that maintains the promotion's cached counter needs to know whether a reservation is
	 * new before it takes a use for it: re-evaluating a cart reuses the row it already holds, and
	 * counting that reuse would spend the promotion's limit on a single cart being edited.
	 *
	 * @param promotionId The promotion.
	 * @param cartId The cart, when the caller has one.
	 * @returns True when a reservation is already held.
	 */
	async hasLiveReservation(promotionId: ID, cartId?: ID): Promise<boolean> {
		return Boolean(await this.findLiveReservation(promotionId, cartId));
	}

	/**
	 * Releases one reservation by its identity, for a caller that has just written it and cannot keep
	 * it — a promotion whose ceiling refused the use it would have cost.
	 *
	 * @param id The reservation to release.
	 * @returns The released row.
	 */
	async releaseUsage(id: ID): Promise<IPromotionUsage | null> {
		const row = await this.typeOrmPromotionUsageRepository.findOneBy({ id, ...this.scope });

		if (!row) {
			return null;
		}

		await this.update(id, { status: PromotionUsageStatus.REVERTED } as never);

		return this.typeOrmPromotionUsageRepository.findOneBy({ id, ...this.scope }) as unknown as IPromotionUsage;
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

		// The first reservation of a cart is the normal case, so a cart that holds no reservation is an
		// answer: the row is created below rather than the lookup failing the reservation.
		const row = await this.typeOrmPromotionUsageRepository.findOneBy({
			promotionId,
			cartId,
			status: PromotionUsageStatus.RESERVED,
			...this.scope
		});

		return (row as IPromotionUsage) ?? null;
	}
}
