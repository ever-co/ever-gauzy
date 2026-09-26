import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import {
	EventBus,
	Money,
	RequestContext,
	compareDecimalStrings,
	normalizeDecimalString,
	quoteIdentifier,
	readAffectedRows,
	toPositionalStatement
} from '@gauzy/core';
import { PromotionChangedEvent } from '../events';
import { Promotion } from './promotion.entity';
import { TypeOrmPromotionRepository } from './repository/type-orm-promotion.repository';
import { MikroOrmPromotionRepository } from './repository/mikro-orm-promotion.repository';
import { PromotionActionService } from '../promotion-action/promotion-action.service';
import { PromotionUsageService } from '../promotion-usage/promotion-usage.service';
import { CampaignService } from '../campaign/campaign.service';
import { CampaignBudgetService } from '../campaign-budget/campaign-budget.service';
import {
	ICampaign,
	IPromotion,
	IPromotionAction,
	IPromotionApplication,
	IPromotionCreateInput,
	IPromotionEvaluationResult,
	IPromotionNotice,
	IPromotionUpdateInput,
	IPromotionUsage,
	PromotionActionAllocation,
	PromotionActionTargetType,
	PromotionActionType,
	PromotionNotice,
	PromotionFunding,
	PromotionStatus,
	PromotionType,
	PromotionUsageStatus,
	RevertOnReturnPolicy
} from '../promotion.types';
import { TenantScopedCrudService } from '../shared/tenant-scoped-crud.service';

/** One line an evaluation may discount. */
export interface IPromotionEvaluationLine {
	readonly id: ID;
	readonly amount: DecimalString;
	readonly quantity: number;
	readonly variantId?: ID;
	readonly sku?: string;
}

/** One shipping method an evaluation may discount. */
export interface IPromotionEvaluationShipping {
	readonly id: ID;
	readonly amount: DecimalString;
}

/**
 * Everything an evaluation is allowed to look at.
 *
 * The context is assembled by the caller — the cart, the checkout or the simulate route — from the
 * kernel rule engine's own attribute paths, so a rule written against `customer.groups.id` reads the
 * same value here as it does in pricing.
 */
export interface IPromotionEvaluationContext {
	readonly currency: string;
	readonly channelId?: ID;
	readonly customerId?: ID;
	readonly customerGroupIds?: ID[];
	readonly codes?: string[];
	readonly lines: IPromotionEvaluationLine[];
	readonly shipping?: IPromotionEvaluationShipping[];
	readonly at?: Date;
}

/** One amount an evaluation decided to take off one owner. */
export interface IPromotionAllocation {
	readonly ownerType: 'LINE' | 'SHIPPING';
	readonly ownerId: ID;
	readonly promotionId: ID;
	readonly actionId: ID;
	readonly code?: string;
	readonly amount: DecimalString;
}

/** What an evaluation produced. */
export interface IPromotionEvaluation {
	readonly result: IPromotionEvaluationResult;
	readonly allocations: IPromotionAllocation[];
}

/** One owner an action would take money off, and how much of it. */
interface IPromotionAdjustmentPart {
	readonly ownerType: 'LINE' | 'SHIPPING';
	readonly ownerId: ID;
	/** The key the owner's remaining discountable amount is held under. */
	readonly key: string;
	readonly amount: Money;
}

/**
 * What one action of a promotion would take off, before the campaign budget has admitted it.
 *
 * The plan is what makes the budget a property of the promotion rather than of one of its actions:
 * every action is computed first, the promotion's total is measured against the ceiling once, and
 * the allocation rows are written from the amount that was admitted.
 */
interface IPromotionAdjustmentPlan {
	readonly action: IPromotionAction;
	readonly parts: IPromotionAdjustmentPart[];
	readonly total: Money;
}

/**
 * Promotions: the offer and its evaluation.
 *
 * The evaluation order in `evaluate` is the authoritative one from the domain specification and is
 * deliberately spelled out as a sequence rather than hidden in a query: candidates are collected,
 * every candidate that is excluded is excluded **with a notice** — a promotion that silently does
 * nothing is the defect an operator cannot diagnose — the survivors are ordered, and each one
 * computes against the amount the promotions before it left behind. That last property is what makes
 * stacking predictable: no promotion can discount money another promotion has already removed.
 *
 * The rules themselves are not evaluated here. Eligibility is a set of `rule` rows read through the
 * kernel's evaluator, so this service asks one question — "does this promotion's rule set match this
 * context" — and never re-implements what "matches" means.
 */
@Injectable()
export class PromotionService extends TenantScopedCrudService<Promotion> {
	constructor(
		readonly typeOrmPromotionRepository: TypeOrmPromotionRepository,
		readonly mikroOrmPromotionRepository: MikroOrmPromotionRepository,
		private readonly promotionActionService: PromotionActionService,
		private readonly promotionUsageService: PromotionUsageService,
		private readonly campaignService: CampaignService,
		private readonly campaignBudgetService: CampaignBudgetService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmPromotionRepository, mikroOrmPromotionRepository);
	}

	/**
	 * The tenant and organization of the caller.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Creates a promotion.
	 *
	 * @param input The promotion to create.
	 * @returns The stored promotion.
	 * @throws BadRequestException when the code is already used or the actions are invalid.
	 */
	async createPromotion(input: IPromotionCreateInput): Promise<IPromotion> {
		const code = input.code ? input.code.trim().toUpperCase() : undefined;

		if (code) {
			// A code nobody has taken is a clash the caller did not create, so the read answers rather
			// than failing: the check is "is this code free", not "does this code exist".
			const clash = await this.typeOrmPromotionRepository.findOneBy({ code, ...this.scope });

			if (clash) {
				throw new BadRequestException(`PROMOTION_ALREADY_APPLIED: the code "${code}" is already in use.`);
			}
		}

		this.assertFunding(input.fundingType, input.sellerFundingShare, input.sellerId);

		const promotion = await this.create({ ...input, code, ...this.scope } as never);

		if (input.actions?.length) {
			await this.promotionActionService.replaceActions(promotion.id, input.actions, promotion.type);
		}

		return this.findPromotionOrFail(promotion.id);
	}

	/**
	 * Updates a promotion.
	 *
	 * @param id The promotion to update.
	 * @param input The fields to change.
	 * @returns The stored promotion.
	 * @throws NotFoundException when the promotion is not in the caller's organization.
	 * @throws BadRequestException when the funding the change states does not describe a funder.
	 */
	async updatePromotion(id: ID, input: IPromotionUpdateInput): Promise<IPromotion> {
		const current = await this.findPromotionOrFail(id);

		/*
		 * The rule is checked against the row the change produces, not against the fields the change
		 * states: a promotion funded by a seller that is moved to `SPLIT` without a share, or a `SPLIT`
		 * promotion whose share is cleared, would otherwise be written in a state the table's own rule
		 * refuses — and the refusal would arrive as a database error rather than as a named one.
		 */
		this.assertFunding(
			input.fundingType ?? current.fundingType,
			input.sellerFundingShare ?? current.sellerFundingShare,
			input.sellerId ?? current.sellerId
		);

		await this.update(id, { ...input } as never);

		return this.findPromotionOrFail(id);
	}

	/**
	 * Refuses funding that does not describe a funder.
	 *
	 * Three rules, and they are the same rule seen from three sides — **money is spent by somebody who
	 * exists**: a promotion funded by a seller names that seller, a split promotion states the share the
	 * seller bears (strictly between nothing and everything, because a "split" of zero or of all of it is
	 * one of the other two fundings written the long way), and a promotion the platform funds names no
	 * seller at all, because a seller on a platform-funded offer would make the ledger attribute a cost
	 * the platform bears. The table carries the same two rules as check constraints on PostgreSQL and
	 * MySQL; this is what turns them into a named refusal with a code a caller can act on, and what
	 * carries them on the embedded dialect.
	 *
	 * @param fundingType Who bears the cost.
	 * @param share The seller's share of a split, when one is stated.
	 * @param sellerId The seller, when one is named.
	 * @throws BadRequestException naming which of the three rules was broken.
	 */
	private assertFunding(
		fundingType?: PromotionFunding,
		share?: DecimalString,
		sellerId?: ID
	): void {
		if (!fundingType || fundingType === PromotionFunding.PLATFORM) {
			if (sellerId) {
				throw new BadRequestException(
					'PROMOTION_FUNDING_SELLER_UNEXPECTED: a promotion the platform funds names no seller, because the cost it bears is not a seller\'s to record.'
				);
			}

			return;
		}

		if (!sellerId) {
			throw new BadRequestException(
				'PROMOTION_FUNDING_SELLER_REQUIRED: a promotion funded by a seller names the seller that bears the cost.'
			);
		}

		if (fundingType !== PromotionFunding.SPLIT) {
			return;
		}

		// The share arrives as an exact decimal string from the API and as a number from a column read,
		// so it is compared through the money layer rather than by parsing it here.
		const stated = share === undefined || share === null ? '0' : String(share);

		if (compareDecimalStrings(stated, '0') <= 0 || compareDecimalStrings(stated, '1') >= 0) {
			throw new BadRequestException(
				`PROMOTION_FUNDING_SHARE_RANGE: a split promotion states the seller's share as a fraction greater than 0 and less than 1, and "${stated}" is not one.`
			);
		}
	}

	/**
	 * Moves a promotion into `ACTIVE`, which is what makes it a candidate.
	 *
	 * @param id The promotion to activate.
	 * @returns The stored promotion.
	 * @throws BadRequestException when the promotion has no action, because an active promotion with no
	 * effect would be a candidate that can never apply.
	 */
	async activate(id: ID): Promise<IPromotion> {
		await this.findPromotionOrFail(id);
		const actions = await this.promotionActionService.findByPromotion(id);

		if (!actions.length) {
			throw new BadRequestException('PROMOTION_NO_ACTIONS');
		}

		await this.update(id, { status: PromotionStatus.ACTIVE } as never);
		await this.announce(id);

		return this.findPromotionOrFail(id);
	}

	/**
	 * Moves a promotion into `INACTIVE`.
	 *
	 * @param id The promotion to deactivate.
	 * @param _reason Why it was stopped; recorded by the caller on the activity log.
	 * @returns The stored promotion.
	 */
	async deactivate(id: ID, _reason?: string): Promise<IPromotion> {
		await this.findPromotionOrFail(id);
		await this.update(id, { status: PromotionStatus.INACTIVE } as never);
		await this.announce(id);

		return this.findPromotionOrFail(id);
	}

	/**
	 * Moves a promotion into `EXPIRED`, which is what the expiry sweep does when a window closes.
	 *
	 * Expiry is a state change rather than a deletion: the promotion keeps its counters and its usage
	 * ledger, so last month's campaign can still be reported on, and a later window is opened by
	 * editing the dates and activating it again.
	 *
	 * @param id The promotion to expire.
	 * @returns The stored promotion.
	 * @throws NotFoundException when the promotion is not in the caller's organization.
	 */
	async expire(id: ID): Promise<IPromotion> {
		await this.findPromotionOrFail(id);
		await this.update(id, { status: PromotionStatus.EXPIRED } as never);
		await this.announce(id);

		return this.findPromotionOrFail(id);
	}

	/**
	 * Publishes the state change of a promotion, so a cache that holds a promotion set can drop it
	 * rather than serve a promotion that has just been switched off.
	 *
	 * @param id The promotion that changed.
	 */
	private async announce(id: ID): Promise<void> {
		const promotion = await this.findPromotionOrFail(id);
		await this.eventBus.publish(PromotionChangedEvent.from(promotion));
	}

	/**
	 * Replaces the action set of a promotion.
	 *
	 * @param id The promotion whose actions are replaced.
	 * @param actions The new action set.
	 * @returns The stored actions, in application order.
	 */
	async replaceActions(id: ID, actions: Partial<IPromotionAction>[]): Promise<IPromotionAction[]> {
		const promotion = await this.findPromotionOrFail(id);

		return this.promotionActionService.replaceActions(id, actions, promotion.type);
	}

	/**
	 * Takes one use of a promotion against its global limit, or refuses it.
	 *
	 * **`usageCount` was incremented by nothing at all.** `isEligible` gates on it — a promotion whose
	 * `usageCount` has reached its `usageLimit` is excluded with `USAGE_LIMIT_EXCEEDED` — and a
	 * repository-wide search for a write to that column found the two literal initialisations of
	 * *coupon* rows and nothing else. A promotion created with `usageLimit: 100` therefore read zero on
	 * every evaluation for ever and could be applied an unbounded number of times: the global cap
	 * advertised on the entity, in the DTOs and in the GraphQL schema was silently a no-op on every
	 * database and both ORMs.
	 *
	 * The increment is a single conditional statement, exactly as the coupon counter's is, so a
	 * promotion with one use left cannot be granted twice by two concurrent checkouts:
	 *
	 * ```sql
	 * UPDATE promotion SET "usageCount" = "usageCount" + 1
	 *  WHERE id = :promotionId AND "tenantId" = :tenantId AND "deletedAt" IS NULL
	 *    AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit");
	 * ```
	 *
	 * @param promotionId The promotion to consume.
	 * @returns True when a use was taken; false when the ceiling refused it.
	 */
	async consume(promotionId: ID): Promise<boolean> {
		const q = quoteIdentifier;
		const tenantId = RequestContext.currentTenantId();
		const sql =
			`UPDATE ${q('promotion')} SET ${q('usageCount')} = ${q('usageCount')} + 1 ` +
			`WHERE ${q('id')} = :promotionId ` +
			// A promotion belongs to the tenant that published it, and a conditional statement that does
			// not say so is one another tenant's identifier can satisfy.
			(tenantId ? `AND ${q('tenantId')} = :tenantId ` : '') +
			`AND ${q('deletedAt')} IS NULL ` +
			`AND (${q('usageLimit')} IS NULL OR ${q('usageCount')} < ${q('usageLimit')})`;
		// Nothing below `QueryBuilder` substitutes a named parameter, and the drivers disagree about
		// the positional form — `$1` on Postgres, `?` on the rest — so the statement is rewritten once,
		// here, by the helper every package on this branch shares.
		const bound = toPositionalStatement(sql, { promotionId, ...(tenantId ? { tenantId } : {}) });

		return readAffectedRows(await this.typeOrmPromotionRepository.query(bound.sql, bound.parameters)) > 0;
	}

	/**
	 * Returns one use of a promotion, on a reversal.
	 *
	 * The counter is floored at zero, so a replayed reversal cannot make a promotion look less used
	 * than it is and hand out a use nobody gave back.
	 *
	 * @param promotionId The promotion to restore.
	 * @returns True when a use was returned.
	 */
	async releaseConsumption(promotionId: ID): Promise<boolean> {
		const usageCount = quoteIdentifier('usageCount');
		const tenantId = RequestContext.currentTenantId();
		const released = this.typeOrmPromotionRepository
			.createQueryBuilder()
			.update(Promotion)
			.set({ usageCount: () => `${usageCount} - 1` })
			.where(`${usageCount} > 0`)
			.andWhere('id = :promotionId', { promotionId });

		if (tenantId) {
			released.andWhere('tenantId = :tenantId', { tenantId });
		}

		return readAffectedRows(await released.execute()) > 0;
	}

	/**
	 * Reserves a redemption of a promotion and takes the use it costs.
	 *
	 * **This is the entry point a checkout uses, and the counter is why.** The redemption ledger and
	 * the cached counter are two halves of one fact — how many times this promotion has been granted —
	 * and writing one without the other is what made `usageLimit` unenforceable. A reservation that
	 * already exists for the cart is reused and costs nothing further, which is what lets a cart be
	 * recalculated on every edit without leaking uses; a new one is counted once, and a promotion whose
	 * ceiling refuses the use has its reservation released again rather than being granted quietly.
	 *
	 * @param input The redemption being reserved.
	 * @returns The reservation row.
	 * @throws BadRequestException when the promotion's global usage limit is already reached.
	 */
	async reserveUsage(input: {
		promotionId: ID;
		couponId?: ID;
		cartId?: ID;
		orderId?: ID;
		customerId?: ID;
		code?: string;
		amount: DecimalString;
		currency: string;
	}): Promise<IPromotionUsage> {
		const existing = await this.promotionUsageService.hasLiveReservation(input.promotionId, input.cartId);
		const usage = await this.promotionUsageService.reserve(input);

		if (existing) {
			return usage;
		}

		if (!(await this.consume(input.promotionId))) {
			// The use was refused after the row was written, so the row goes back: a reservation nobody
			// may redeem would hold budget and count against the per-customer limit for ever.
			await this.promotionUsageService.releaseUsage(usage.id);

			throw new BadRequestException(
				`PROMOTION_USAGE_LIMIT_EXCEEDED: promotion ${input.promotionId} has reached its usage limit.`
			);
		}

		return usage;
	}

	/**
	 * Reverts a redemption and gives back the use it took, when the whole of it is reverted.
	 *
	 * @param promotionId The promotion whose redemption is being reverted.
	 * @param orderId The order the redemption belongs to.
	 * @param policy What the domain says about reversibility on a return.
	 * @param returnedShare The share of the order that came back, for a proportional policy.
	 * @returns What was reverted, and the row.
	 */
	async revertUsage(
		promotionId: ID,
		orderId: ID,
		policy?: RevertOnReturnPolicy,
		returnedShare: DecimalString | number = 1
	): Promise<{ reverted: DecimalString; usage: IPromotionUsage | null }> {
		const result = await this.promotionUsageService.revert(promotionId, orderId, policy, returnedShare);

		// A partial reversal leaves the redemption registered — the customer kept part of what the
		// promotion gave them — so the use it took stays taken. Only a redemption that is wholly
		// reverted gives its use back.
		if (result.usage?.status === PromotionUsageStatus.REVERTED) {
			await this.releaseConsumption(promotionId);
		}

		return result;
	}

	/**
	 * Releases every reservation a cart holds and gives back the uses they took.
	 *
	 * @param cartId The cart whose reservations are released.
	 * @returns The rows that were released.
	 */
	async releaseCartUsage(cartId: ID): Promise<IPromotionUsage[]> {
		const released = await this.promotionUsageService.releaseCart(cartId);

		for (const row of released) {
			await this.releaseConsumption(row.promotionId);
		}

		return released;
	}

	/**
	 * Re-derives a promotion's cached counter from the redemption ledger.
	 *
	 * The entity's own docstring defers the maintenance of `usageCount` to a nightly job, and no such
	 * job existed anywhere in the package — a search for `Cron` or `reconcil` in it returned prose in
	 * comments. This is what that job calls: the ledger is the authority, the counter is a cache, and a
	 * cache that has drifted is repaired from the authority rather than trusted.
	 *
	 * @param promotionId The promotion to audit.
	 * @returns What the counter held, what the ledger says, and whether the two disagreed.
	 */
	async auditUsageCount(promotionId: ID): Promise<{ cached: number; ledger: number; repaired: boolean }> {
		const promotion = await this.findPromotionOrFail(promotionId);
		const ledger = await this.promotionUsageService.countLive(promotionId);
		const cached = Number(promotion.usageCount ?? 0);

		if (cached === ledger) {
			return { cached, ledger, repaired: false };
		}

		await this.update(promotionId, { usageCount: ledger } as never);

		return { cached, ledger, repaired: true };
	}

	/**
	 * Reads the redemption ledger of a promotion.
	 *
	 * @param id The promotion to read.
	 * @param options Optional filters.
	 * @returns One page of redemptions.
	 */
	async findUsage(id: ID, options: Record<string, unknown> = {}): Promise<IPagination<IPromotionUsage>> {
		await this.findPromotionOrFail(id);

		return this.promotionUsageService.findByPromotion(id, options);
	}

	/**
	 * A page of promotions of the caller's organization.
	 *
	 * @param options Optional filters.
	 * @returns One page of promotions.
	 */
	async findPromotions(options: Record<string, unknown> = {}): Promise<IPagination<IPromotion>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Loads a promotion of the caller's organization.
	 *
	 * @param id The promotion to load.
	 * @returns The promotion.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	async findPromotionOrFail(id: ID): Promise<IPromotion> {
		const promotion = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!promotion) {
			throw new NotFoundException('PROMOTION_NOT_FOUND');
		}

		return promotion;
	}

	/**
	 * Evaluates every promotion that may apply to a context, and reports what it decided.
	 *
	 * The result is deterministic: the same context and the same promotion set always produce the same
	 * allocations, which is what makes a simulation a promise rather than an estimate, and what makes
	 * the checked-in golden fixtures meaningful.
	 *
	 * @param context What may be discounted and what the eligibility rules are read against.
	 * @param onlyPromotionId Restricts the evaluation to one promotion, for the simulate route.
	 * @returns The applications, the notices and the per-owner allocations.
	 */
	async evaluate(context: IPromotionEvaluationContext, onlyPromotionId?: ID): Promise<IPromotionEvaluation> {
		const notices: IPromotionNotice[] = [];
		const applications: IPromotionApplication[] = [];
		const allocations: IPromotionAllocation[] = [];
		const at = context.at ?? new Date();

		// 1. Candidates: the coded promotions the caller presented, plus every automatic one that is
		// running, in the channel and in the currency, and open to this customer.
		const candidates = await this.collectCandidates(context, at, notices);

		// 2. Ordering. Buy-and-get first, because it creates the free units no later promotion may
		// discount again; then by priority; then by the value the promotion could give away, so the
		// customer-favourable offer wins the remaining-discountable race on a tie.
		const ordered = candidates
			.filter((promotion) => !onlyPromotionId || promotion.id === onlyPromotionId)
			.sort((left, right) => {
				const buyGet =
					Number(right.type === PromotionType.BUY_GET) - Number(left.type === PromotionType.BUY_GET);

				if (buyGet !== 0) {
					return buyGet;
				}

				if (left.priority !== right.priority) {
					return left.priority - right.priority;
				}

				return String(left.id).localeCompare(String(right.id));
			});

		// The remaining discountable amount is per owner, not per promotion: a later promotion sees
		// what the earlier ones left and no more. It is money, so it is carried as money — a `number`
		// would drop a cent the moment a cart holds an amount binary floating point cannot represent.
		const remaining = new Map<string, Money>();
		for (const line of context.lines) {
			remaining.set(`LINE:${line.id}`, Money.of(line.amount, context.currency));
		}
		for (const method of context.shipping ?? []) {
			remaining.set(`SHIPPING:${method.id}`, Money.of(method.amount, context.currency));
		}

		// **Exclusivity, which was declared everywhere and enforced nowhere.** `isCombinable` and
		// `stackingGroup` are columns, DTO members and GraphQL fields, and `STACKING_CONFLICT` is a
		// notice code — and nothing read any of the three: a merchant could mark a fifty-percent offer
		// non-combinable in a group and watch a ten-percent offer in the same group stack on top of it
		// for fifty-five percent off, with no notice saying why the exclusivity they configured did
		// nothing. A group closes as soon as a non-combinable promotion in it wins something, and every
		// later candidate of that group is refused with the notice.
		const closedGroups = new Set<string>();

		for (const promotion of ordered) {
			if (promotion.stackingGroup && closedGroups.has(promotion.stackingGroup)) {
				notices.push(
					this.notice(
						promotion,
						PromotionNotice.STACKING_CONFLICT,
						'Another promotion of this stacking group is exclusive and has already been applied.',
						{ stackingGroup: promotion.stackingGroup }
					)
				);
				continue;
			}

			const eligible = await this.isEligible(promotion, context, at, notices);

			if (!eligible) {
				continue;
			}

			const actions = await this.promotionActionService.findByPromotion(promotion.id);
			const plans: IPromotionAdjustmentPlan[] = [];
			let promotionTotal = Money.zero(context.currency);

			for (const action of actions.sort((left, right) => left.position - right.position)) {
				const plan = this.planAction(action, context, remaining);

				if (plan) {
					plans.push(plan);
					promotionTotal = promotionTotal.add(plan.total);
				}
			}

			if (!promotionTotal.isPositive()) {
				notices.push(this.notice(promotion, PromotionNotice.NO_DISCOUNTABLE_AMOUNT, 'Nothing was left to discount.'));
				continue;
			}

			// The ceiling is checked against the promotion's total, once, and what it truncates is taken
			// off the parts as well as off the total: the allocations report what was granted, never what
			// was computed (doc 08 §11.3, §11 step 6).
			const budgetHeadroom = await this.budgetHeadroom(promotion, context.currency);
			let appliedTotal = promotionTotal;

			if (budgetHeadroom !== null && budgetHeadroom.lessThan(promotionTotal)) {
				notices.push(
					this.notice(
						promotion,
						PromotionNotice.PARTIALLY_APPLIED_BUDGET,
						'The campaign budget admitted only part of the computed discount.',
						{
							computed: promotionTotal.toStorageString(),
							headroom: budgetHeadroom.toStorageString()
						}
					)
				);
				appliedTotal = Money.max(Money.zero(context.currency), budgetHeadroom);
			}

			// A discount the budget refused outright is a discount nobody was given, so the amount it was
			// measured against goes back to its owners before the next candidate is evaluated.
			this.commit(promotion, plans, appliedTotal, remaining, allocations);

			if (!appliedTotal.isPositive()) {
				notices.push(this.notice(promotion, PromotionNotice.BUDGET_EXCEEDED, 'The campaign budget is spent.'));
				continue;
			}

			applications.push({
				promotionId: promotion.id,
				code: promotion.code,
				isAutomatic: promotion.isAutomatic,
				amount: appliedTotal.toStorageString(),
				currency: context.currency
			});

			// The group closes on a promotion that actually gave something away. A non-combinable offer
			// the budget refused outright has taken nothing off the cart, and closing the group behind it
			// would deny the customer an offer that could still have applied.
			if (promotion.isCombinable === false && promotion.stackingGroup) {
				closedGroups.add(promotion.stackingGroup);
			}
		}

		const discountTotal = Money.sum(
			allocations.map((allocation) => Money.of(allocation.amount, context.currency)),
			context.currency
		);

		return {
			allocations,
			result: {
				applications,
				notices,
				discountTotal: discountTotal.abs().negate().toStorageString(),
				currency: context.currency
			}
		};
	}

	/**
	 * Simulates one promotion against a context without writing anything: no adjustment, no usage row,
	 * no budget movement. It answers with the same notices the evaluation would report, which is what
	 * makes "why did this promotion not fire" answerable before it is published.
	 *
	 * @param id The promotion to simulate.
	 * @param context What it is simulated against.
	 * @returns The applications, notices and allocations it would produce.
	 */
	async simulate(id: ID, context: IPromotionEvaluationContext): Promise<IPromotionEvaluation> {
		await this.findPromotionOrFail(id);

		return this.evaluate(context, id);
	}

	/**
	 * Collects the candidates: the coded promotions presented by the caller and every automatic one
	 * that is running and open to this customer. A promotion reached both ways appears once.
	 *
	 * @param context The evaluation context.
	 * @param at The instant of the evaluation.
	 * @param notices The notice list the collection appends to.
	 * @returns The candidate promotions.
	 */
	private async collectCandidates(
		context: IPromotionEvaluationContext,
		at: Date,
		notices: IPromotionNotice[]
	): Promise<IPromotion[]> {
		const candidates = new Map<string, IPromotion>();

		if (context.codes?.length) {
			for (const codeRaw of context.codes) {
				const code = codeRaw.trim().toUpperCase();
				// A code the caller presented that names nothing is an answer, not a failure: one
				// mistyped code in a cart must not turn the whole price calculation into a 404
				// (doc 08 §11 step 1, doc 06 §6.6 `COUPON_INVALID`).
				const coded = await this.typeOrmPromotionRepository.findOneBy({ code, ...this.scope });

				if (!coded) {
					notices.push({
						promotionId: '' as ID,
						code,
						notice: PromotionNotice.COUPON_INACTIVE,
						message: `No promotion carries the code "${code}".`
					});
					continue;
				}

				candidates.set(coded.id, coded);
			}
		}

		const automatic = (await this.typeOrmPromotionRepository.find({
			where: {
				status: PromotionStatus.ACTIVE,
				isAutomatic: true,
				...this.scope
			}
		})) as unknown as IPromotion[];

		for (const promotion of automatic) {
			if (promotion.channelId && context.channelId && promotion.channelId !== context.channelId) {
				continue;
			}

			if (promotion.currency && promotion.currency !== context.currency) {
				continue;
			}

			if (
				promotion.customerGroupId &&
				!(context.customerGroupIds ?? []).includes(promotion.customerGroupId)
			) {
				continue;
			}

			if (!this.isWindowOpen(promotion, at)) {
				continue;
			}

			candidates.set(promotion.id, promotion);
		}

		return [...candidates.values()];
	}

	/**
	 * The eligibility filter. Every exclusion names its reason, in the order the domain fixes, so the
	 * first thing that went wrong is the thing the caller is told about.
	 *
	 * @param promotion The candidate.
	 * @param context The evaluation context.
	 * @param at The instant of the evaluation.
	 * @param notices The notice list to append to.
	 * @returns True when the promotion may be applied.
	 */
	private async isEligible(
		promotion: IPromotion,
		context: IPromotionEvaluationContext,
		at: Date,
		notices: IPromotionNotice[]
	): Promise<boolean> {
		if (promotion.status !== PromotionStatus.ACTIVE) {
			notices.push(this.notice(promotion, PromotionNotice.PROMOTION_INACTIVE, 'The promotion is not active.'));
			return false;
		}

		if (!this.isWindowOpen(promotion, at)) {
			notices.push(this.notice(promotion, PromotionNotice.PROMOTION_EXPIRED, 'The promotion window is closed.'));
			return false;
		}

		if (promotion.campaignId) {
			const campaign = (await this.campaignService.findOneByWhereOptions({
				id: promotion.campaignId,
				...this.scope
			} as never)) as unknown as ICampaign | null;

			if (campaign && !this.campaignService.isRunning(campaign, at)) {
				notices.push(
					this.notice(promotion, PromotionNotice.CAMPAIGN_WINDOW_CLOSED, 'The campaign window is closed.')
				);
				return false;
			}
		}

		if (promotion.currency && promotion.currency !== context.currency) {
			notices.push(this.notice(promotion, PromotionNotice.CURRENCY_MISMATCH, 'The promotion is priced in another currency.'));
			return false;
		}

		if (promotion.channelId && context.channelId && promotion.channelId !== context.channelId) {
			notices.push(this.notice(promotion, PromotionNotice.PROMOTION_INACTIVE, 'The promotion belongs to another channel.'));
			return false;
		}

		if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usageCount >= promotion.usageLimit) {
			notices.push(this.notice(promotion, PromotionNotice.USAGE_LIMIT_EXCEEDED, 'The promotion usage limit is reached.'));
			return false;
		}

		if (promotion.perCustomerUsageLimit && context.customerId) {
			const used = await this.promotionUsageService.countByCustomer(promotion.id, context.customerId);

			if (used >= promotion.perCustomerUsageLimit) {
				notices.push(
					this.notice(promotion, PromotionNotice.PER_CUSTOMER_LIMIT_EXCEEDED, 'The customer has used this promotion already.')
				);
				return false;
			}
		}

		const headroom = await this.budgetHeadroom(promotion, context.currency);

		if (headroom !== null && !headroom.isPositive()) {
			notices.push(this.notice(promotion, PromotionNotice.BUDGET_EXCEEDED, 'The promotion budget is spent.'));
			return false;
		}

		return true;
	}

	/**
	 * Computes what one action takes off, and from which owners.
	 *
	 * Nothing is written to the allocation list here. A promotion's total is only known once every one
	 * of its actions has been computed, and the campaign's ceiling is measured against that total — so
	 * the rows are written by `commit`, from the amount the ceiling admitted (doc 08 §11 step 6).
	 *
	 * @param action The action to apply.
	 * @param context The evaluation context.
	 * @param remaining The per-owner remaining discountable amounts, charged in place.
	 * @returns What the action would take off, or null when it has nothing to take off.
	 */
	private planAction(
		action: IPromotionAction,
		context: IPromotionEvaluationContext,
		remaining: Map<string, Money>
	): IPromotionAdjustmentPlan | null {
		const currency = context.currency;
		const targetedLines =
			action.targetType === PromotionActionTargetType.SHIPPING
				? []
				: context.lines.filter((line) => this.isDiscountable(remaining, `LINE:${line.id}`));
		const targetedShipping =
			action.targetType === PromotionActionTargetType.ITEMS
				? []
				: (context.shipping ?? []).filter((method) => this.isDiscountable(remaining, `SHIPPING:${method.id}`));

		const owners = [
			...targetedLines.map((line) => ({ ownerType: 'LINE' as const, ownerId: line.id, key: `LINE:${line.id}` })),
			...targetedShipping.map((method) => ({
				ownerType: 'SHIPPING' as const,
				ownerId: method.id,
				key: `SHIPPING:${method.id}`
			}))
		];

		if (!owners.length) {
			return null;
		}

		const weights = owners.map((owner) => remaining.get(owner.key) ?? Money.zero(currency));
		const discountable = Money.sum(weights, currency);
		const stated = action.value !== null && action.value !== undefined && String(action.value).trim() !== '';
		const percentage =
			action.type === PromotionActionType.PERCENTAGE || action.type === PromotionActionType.TIERED_PERCENTAGE;
		let discount: Money;

		if (percentage) {
			// `f(value, Σ discountable)`: an exact decimal scaled by the percentage and divided by a
			// hundred, so ten percent of `49.98` is the `4.998` the currency scale then resolves, never
			// the `4.997999999999999` a binary floating-point product would leave behind.
			//
			// **A tiered percentage takes its percentage from the band the amount falls in.** The
			// comment here already said the percentage "carries its percentage in `metadata.tiers`
			// rather than in `value`", and the line under it then used `action.value` for both action
			// types — so a `TIERED_PERCENTAGE` with a schedule and no `value` computed nothing at all
			// and reported `NO_DISCOUNTABLE_AMOUNT`, while one that also carried a `value` applied that
			// flat percentage to every order regardless of which band it reached. `assertTiers`
			// validated the schedule on write and nothing ever read it.
			const percentText = this.percentageFor(action, discountable);

			if (percentText === null) {
				return null;
			}

			discount = discountable.multiply(percentText).divide(100);
		} else if (action.type === PromotionActionType.FREE_SHIPPING && !stated) {
			// Free shipping discounts the targeted methods to zero (doc 08 §10.1); a stated value is the
			// cap the operator put on it.
			discount = discountable;
		} else {
			if (!stated) {
				return null;
			}

			discount = Money.min(Money.of(action.value, currency), discountable);
		}

		if (action.allocation === PromotionActionAllocation.EACH) {
			// The per-unit discount is computed once and applied to whole units, so a `maxQuantity` cap
			// cannot be crossed by a fraction of a unit.
			const units = Math.min(
				Number(action.applyToQuantity ?? Number.MAX_SAFE_INTEGER),
				Number(action.maxQuantity ?? Number.MAX_SAFE_INTEGER)
			);

			discount = discount.divide(owners.length).multiply(Math.min(units, owners.length));
		}

		const cap = (action.metadata as { maxDiscountAmount?: DecimalString } | undefined)?.maxDiscountAmount;

		if (cap !== null && cap !== undefined) {
			discount = Money.min(discount, Money.of(cap, currency));
		}

		discount = Money.min(discount, discountable);

		if (!discount.isPositive()) {
			return null;
		}

		// The split is the largest-remainder allocation, so the parts sum back to the whole exactly and
		// no cent is created or lost by rounding.
		const parts = discount.allocate(weights.map((weight) => weight.amount));
		const charges: IPromotionAdjustmentPart[] = [];
		let total = Money.zero(currency);

		for (const [index, part] of parts.entries()) {
			const owner = owners[index];

			if (!part.isPositive()) {
				continue;
			}

			remaining.set(owner.key, (remaining.get(owner.key) ?? Money.zero(currency)).subtract(part));
			charges.push({ ownerType: owner.ownerType, ownerId: owner.ownerId, key: owner.key, amount: part });
			total = total.add(part);
		}

		return { action, parts: charges, total };
	}

	/**
	 * The percentage one action takes off, for the amount it is applied to.
	 *
	 * A `PERCENTAGE` states its percentage in `value` and this is that value. A `TIERED_PERCENTAGE`
	 * states a schedule in `metadata.tiers` — validated on write by `PromotionActionService.assertTiers`
	 * as at least one tier with strictly increasing thresholds and a percentage in `(0, 100]` — and
	 * the band that applies is the last one whose threshold the amount reaches. A tiered action whose
	 * schedule no band of matches falls back to its stated `value`, so an operator can express "five
	 * percent below a hundred" either as a first tier or as the action's own value.
	 *
	 * The comparison is `compareDecimalStrings` and not `Number`: a threshold is money, the amount it
	 * is measured against is money, and deciding which side of a boundary an order falls on by
	 * subtracting two doubles is how an order of exactly a hundred lands in the wrong band.
	 *
	 * @param action The action to read.
	 * @param discountable The amount the action would be applied to.
	 * @returns The percentage as an exact decimal, or null when the action states none and no band
	 * matches — an action with no percentage has nothing to take off.
	 */
	private percentageFor(action: IPromotionAction, discountable: Money): DecimalString | null {
		const stated =
			action.value !== null && action.value !== undefined && String(action.value).trim() !== ''
				? normalizeDecimalString(action.value as DecimalString)
				: null;

		if (action.type !== PromotionActionType.TIERED_PERCENTAGE) {
			return stated;
		}

		const tiers = (action.metadata as { tiers?: Array<{ threshold?: unknown; percent?: unknown }> } | undefined)
			?.tiers;

		if (!Array.isArray(tiers) || tiers.length === 0) {
			return stated;
		}

		let winner: DecimalString | null = null;
		let winningThreshold: DecimalString | null = null;

		for (const tier of tiers) {
			let threshold: DecimalString;
			let percent: DecimalString;

			try {
				threshold = normalizeDecimalString(tier?.threshold as DecimalString);
				percent = normalizeDecimalString(tier?.percent as DecimalString);
			} catch {
				// A malformed tier is skipped rather than fatal: the schedule was validated when it was
				// written, and an evaluation is not the place to fail a checkout over a row that was.
				continue;
			}

			// The band applies when the amount reaches its threshold, and the highest such band wins —
			// the list is validated as strictly increasing, but nothing guarantees the order it is
			// stored in, so the winner is chosen by comparison rather than by position.
			if (compareDecimalStrings(discountable.amount, threshold) < 0) {
				continue;
			}

			if (winningThreshold === null || compareDecimalStrings(threshold, winningThreshold) > 0) {
				winner = percent;
				winningThreshold = threshold;
			}
		}

		return winner ?? stated;
	}

	/**
	 * Writes the allocation rows of a promotion, from the amount the campaign budget admitted.
	 *
	 * A discount the ceiling truncated is re-allocated across the targets its actions computed, by
	 * largest remainder, so Σ|allocations| equals the application to the last minor unit and the parts
	 * of a split sum to the whole exactly. A promotion the ceiling refused outright writes no row and
	 * gives back everything its actions charged, so the next candidate is not charged for a discount
	 * nobody was given (doc 08 §11.3).
	 *
	 * @param promotion The promotion being applied.
	 * @param plans What each of its actions computed.
	 * @param appliedTotal What the campaign budget admitted.
	 * @param remaining The per-owner remaining discountable amounts, corrected in place.
	 * @param allocations The allocation list to append to.
	 */
	private commit(
		promotion: IPromotion,
		plans: IPromotionAdjustmentPlan[],
		appliedTotal: Money,
		remaining: Map<string, Money>,
		allocations: IPromotionAllocation[]
	): void {
		const currency = appliedTotal.currency;
		const computedTotal = Money.sum(
			plans.map((plan) => plan.total),
			currency
		);
		const truncated = !appliedTotal.equals(computedTotal);
		const shares = truncated
			? appliedTotal.allocate(plans.flatMap((plan) => plan.parts.map((part) => part.amount.amount)))
			: [];
		let index = 0;

		for (const plan of plans) {
			for (const part of plan.parts) {
				const share = truncated ? shares[index] : part.amount;

				index += 1;

				if (truncated) {
					// What the ceiling did not admit is still discountable, so it goes back to its owner.
					remaining.set(
						part.key,
						(remaining.get(part.key) ?? Money.zero(currency)).add(part.amount.subtract(share))
					);
				}

				if (!share.isPositive()) {
					continue;
				}

				allocations.push({
					ownerType: part.ownerType,
					ownerId: part.ownerId,
					promotionId: promotion.id,
					actionId: plan.action.id,
					code: promotion.code,
					amount: share.negate().toStorageString()
				});
			}
		}
	}

	/**
	 * Whether an owner still has something left to discount.
	 *
	 * @param remaining The per-owner remaining discountable amounts.
	 * @param key The owner's key.
	 * @returns True when the owner has a positive amount left.
	 */
	private isDiscountable(remaining: Map<string, Money>, key: string): boolean {
		return remaining.get(key)?.isPositive() ?? false;
	}

	/**
	 * The headroom of a promotion's budget, which is the smaller of its inline budget and its
	 * campaign's when it has both.
	 *
	 * A budget is optional: a campaign is a window, and a promotion attached to one is unbudgeted —
	 * not invalid — when no ceiling has been set, so the read leaves it unbudgeted rather than failing
	 * the whole evaluation (doc 08 §12.2, §11.3).
	 *
	 * @param promotion The promotion to measure.
	 * @param currency The currency the evaluation is priced in.
	 * @returns The headroom, or null when the promotion has no budget at all.
	 */
	private async budgetHeadroom(promotion: IPromotion, currency: string): Promise<Money | null> {
		const headrooms: Money[] = [];

		if (promotion.budgetAmount !== null && promotion.budgetAmount !== undefined) {
			headrooms.push(
				Money.fromStorage(promotion.budgetAmount, currency).subtract(
					Money.fromStorage(promotion.budgetSpent, currency)
				)
			);
		}

		if (promotion.campaignId) {
			const budget = await this.campaignBudgetService.findBudget(promotion.campaignId);

			// A campaign with no budget row is a campaign with no money ceiling. A ceiling with no limit
			// is an unlimited one rather than a spent one, so neither is a headroom of zero.
			if (budget && budget.limit !== null && budget.limit !== undefined) {
				headrooms.push(
					Money.fromStorage(budget.limit, currency).subtract(Money.fromStorage(budget.used, currency))
				);
			}
		}

		return headrooms.length ? headrooms.reduce((smallest, headroom) => Money.min(smallest, headroom)) : null;
	}

	/**
	 * Whether a promotion's own window contains an instant. A null bound means "already open" or
	 * "never closes", and the upper bound is exclusive.
	 *
	 * @param promotion The promotion to test.
	 * @param at The instant to test.
	 * @returns True when the window is open.
	 */
	private isWindowOpen(promotion: IPromotion, at: Date): boolean {
		const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
		const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

		if (startsAt && startsAt > at) {
			return false;
		}

		return !(endsAt && endsAt <= at);
	}

	/**
	 * Builds one notice.
	 *
	 * @param promotion The promotion the notice is about.
	 * @param notice The notice code.
	 * @param message What a person should read.
	 * @param details Any figures that make the notice actionable.
	 * @returns The notice.
	 */
	private notice(
		promotion: IPromotion,
		notice: PromotionNotice,
		message: string,
		details?: Record<string, unknown>
	): IPromotionNotice {
		return { promotionId: promotion.id, code: promotion.code ?? '', notice, message, details };
	}
}
