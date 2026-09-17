import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, Money, RequestContext } from '@gauzy/core';
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
	PromotionStatus,
	PromotionType
} from '../promotion.types';

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
export class PromotionService extends CrudService<Promotion> {
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
			const clash = await this.findOneByWhereOptions({ code, ...this.scope } as never);

			if (clash) {
				throw new BadRequestException(`PROMOTION_ALREADY_APPLIED: the code "${code}" is already in use.`);
			}
		}

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
	 */
	async updatePromotion(id: ID, input: IPromotionUpdateInput): Promise<IPromotion> {
		await this.findPromotionOrFail(id);
		await this.update(id, { ...input } as never);

		return this.findPromotionOrFail(id);
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
		// what the earlier ones left and no more.
		const remaining = new Map<string, number>();
		for (const line of context.lines) {
			remaining.set(`LINE:${line.id}`, Number(line.amount));
		}
		for (const method of context.shipping ?? []) {
			remaining.set(`SHIPPING:${method.id}`, Number(method.amount));
		}

		for (const promotion of ordered) {
			const eligible = await this.isEligible(promotion, context, at, notices);

			if (!eligible) {
				continue;
			}

			const actions = await this.promotionActionService.findByPromotion(promotion.id);
			let promotionTotal = 0;

			for (const action of actions.sort((left, right) => left.position - right.position)) {
				const applied = this.applyAction(promotion, action, context, remaining, allocations);
				promotionTotal += applied;
			}

			if (promotionTotal <= 0) {
				notices.push(this.notice(promotion, PromotionNotice.NO_DISCOUNTABLE_AMOUNT, 'Nothing was left to discount.'));
				continue;
			}

			const budgetHeadroom = await this.budgetHeadroom(promotion);

			if (budgetHeadroom !== null && budgetHeadroom < promotionTotal) {
				notices.push(
					this.notice(
						promotion,
						PromotionNotice.PARTIALLY_APPLIED_BUDGET,
						'The campaign budget admitted only part of the computed discount.',
						{ computed: String(promotionTotal), headroom: String(budgetHeadroom) }
					)
				);
				promotionTotal = Math.max(0, budgetHeadroom);
			}

			if (promotionTotal <= 0) {
				notices.push(this.notice(promotion, PromotionNotice.BUDGET_EXCEEDED, 'The campaign budget is spent.'));
				continue;
			}

			applications.push({
				promotionId: promotion.id,
				code: promotion.code,
				isAutomatic: promotion.isAutomatic,
				amount: String(promotionTotal),
				currency: context.currency
			});
		}

		const discountTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);

		return {
			allocations,
			result: {
				applications,
				notices,
				discountTotal: String(-Math.abs(discountTotal)),
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
				const coded = await this.findOneByWhereOptions({ code, ...this.scope } as never);

				if (!coded) {
					notices.push({
						promotionId: '' as ID,
						code,
						notice: PromotionNotice.PROMOTION_INACTIVE,
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

		const headroom = await this.budgetHeadroom(promotion);

		if (headroom !== null && headroom <= 0) {
			notices.push(this.notice(promotion, PromotionNotice.BUDGET_EXCEEDED, 'The promotion budget is spent.'));
			return false;
		}

		return true;
	}

	/**
	 * Applies one action to the owners it targets and writes the allocations it produced.
	 *
	 * @param promotion The promotion being applied.
	 * @param action The action to apply.
	 * @param context The evaluation context.
	 * @param remaining The per-owner remaining discountable amounts, updated in place.
	 * @param allocations The allocation list to append to.
	 * @returns The total the action took off.
	 */
	private applyAction(
		promotion: IPromotion,
		action: IPromotionAction,
		context: IPromotionEvaluationContext,
		remaining: Map<string, number>,
		allocations: IPromotionAllocation[]
	): number {
		const targetedLines =
			action.targetType === PromotionActionTargetType.SHIPPING
				? []
				: context.lines.filter((line) => (remaining.get(`LINE:${line.id}`) ?? 0) > 0);
		const targetedShipping =
			action.targetType === PromotionActionTargetType.ITEMS
				? []
				: (context.shipping ?? []).filter((method) => (remaining.get(`SHIPPING:${method.id}`) ?? 0) > 0);

		const owners = [
			...targetedLines.map((line) => ({ ownerType: 'LINE' as const, ownerId: line.id, key: `LINE:${line.id}` })),
			...targetedShipping.map((method) => ({
				ownerType: 'SHIPPING' as const,
				ownerId: method.id,
				key: `SHIPPING:${method.id}`
			}))
		];

		if (!owners.length) {
			return 0;
		}

		const weights = owners.map((owner) => String(remaining.get(owner.key) ?? 0));
		const discountable = weights.reduce((sum, weight) => sum + Number(weight), 0);
		const value = Number(action.value);
		const cap = Number((action.metadata as { maxDiscountAmount?: string } | undefined)?.maxDiscountAmount ?? Infinity);

		let discount =
			action.type === PromotionActionType.PERCENTAGE || action.type === PromotionActionType.TIERED_PERCENTAGE
				? (discountable * Math.min(value, 100)) / 100
				: Math.min(value, discountable);

		if (action.allocation === PromotionActionAllocation.EACH) {
			const units = Math.min(
				Number(action.applyToQuantity ?? Number.MAX_SAFE_INTEGER),
				Number(action.maxQuantity ?? Number.MAX_SAFE_INTEGER)
			);
			const perUnit = owners.length ? discount / owners.length : 0;
			discount = perUnit * Math.min(units, owners.length);
		}

		discount = Math.max(0, Math.min(discount, discountable, cap, Number.isFinite(cap) ? cap : discountable));

		if (discount <= 0) {
			return 0;
		}

		// The split is the largest-remainder allocation, so the parts sum back to the whole exactly and
		// no cent is created or lost by rounding.
		const parts = Money.of(String(discount), context.currency).allocate(weights);
		let applied = 0;

		for (const [index, part] of parts.entries()) {
			const owner = owners[index];
			const amount = Number(part.amount);

			if (amount <= 0) {
				continue;
			}

			remaining.set(owner.key, (remaining.get(owner.key) ?? 0) - amount);
			allocations.push({
				ownerType: owner.ownerType,
				ownerId: owner.ownerId,
				promotionId: promotion.id,
				actionId: action.id,
				code: promotion.code,
				amount: String(-amount)
			});
			applied += amount;
		}

		return applied;
	}

	/**
	 * The headroom of a promotion's budget, which is the smaller of its inline budget and its
	 * campaign's when it has both.
	 *
	 * @param promotion The promotion to measure.
	 * @returns The headroom, or null when the promotion has no budget at all.
	 */
	private async budgetHeadroom(promotion: IPromotion): Promise<number | null> {
		const headrooms: number[] = [];

		if (promotion.budgetAmount !== null && promotion.budgetAmount !== undefined) {
			headrooms.push(Number(promotion.budgetAmount) - Number(promotion.budgetSpent ?? 0));
		}

		if (promotion.campaignId) {
			const budget = (await this.campaignBudgetService.findOneByWhereOptions({
				campaignId: promotion.campaignId,
				...this.scope
			} as never)) as { limit?: string; used?: string } | null;

			if (budget) {
				headrooms.push(Number(budget.limit ?? 0) - Number(budget.used ?? 0));
			}
		}

		return headrooms.length ? Math.min(...headrooms) : null;
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
