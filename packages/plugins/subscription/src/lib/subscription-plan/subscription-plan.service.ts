import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { Money, RequestContext, TenantAwareCrudService, isUniqueViolation } from '@gauzy/core';
import {
	ISubscriptionCatalogPort,
	ISubscriptionPlan,
	SUBSCRIPTION_CATALOG,
	SubscriptionBillingPeriod,
	SubscriptionStatus
} from '../subscription.types';
import { ISubscriptionCadence, normalizeDecimal, normalizeDiscountFraction } from '../subscription.cycle';
import { currentScope } from '../subscription.scope';
import { SubscriptionPlan } from './subscription-plan.entity';
import { MikroOrmSubscriptionPlanRepository } from './repository/mikro-orm-subscription-plan.repository';
import { TypeOrmSubscriptionPlanRepository } from './repository/type-orm-subscription-plan.repository';
import { TypeOrmSubscriptionRepository } from '../subscription/repository/type-orm-subscription.repository';

/** The statuses that count as a plan being in use. */
const LIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
	SubscriptionStatus.PENDING,
	SubscriptionStatus.ACTIVE,
	SubscriptionStatus.PAUSED,
	SubscriptionStatus.FAILED
];

/**
 * Plans: what can be subscribed to, and on what terms.
 *
 * The service owns three rules that the table alone cannot state:
 *
 * - **A code is a promise.** Inside one organization it means exactly one plan, which is why the
 *   write path checks it before the database does and why it cannot be moved once somebody is
 *   subscribed to it: a customer, an invoice and an import all quote the code.
 * - **A plan that is in use is not deactivated silently.** Turning `isActive` off stops new
 *   subscriptions and leaves the running ones billing, so a request that would strand a live
 *   customer is refused with a named code rather than accepted quietly.
 * - **A plan's target must be sellable on a recurring basis.** The catalogue answers that question,
 *   not this table; the check runs on every creation and never on a renewal, because withdrawing a
 *   variant must not stop an agreement already paid for.
 */
@Injectable()
export class SubscriptionPlanService extends TenantAwareCrudService<SubscriptionPlan> {
	constructor(
		readonly typeOrmSubscriptionPlanRepository: TypeOrmSubscriptionPlanRepository,
		readonly mikroOrmSubscriptionPlanRepository: MikroOrmSubscriptionPlanRepository,
		readonly typeOrmSubscriptionRepository: TypeOrmSubscriptionRepository,
		@Optional()
		@Inject(SUBSCRIPTION_CATALOG)
		private readonly catalog?: ISubscriptionCatalogPort
	) {
		super(typeOrmSubscriptionPlanRepository, mikroOrmSubscriptionPlanRepository);
	}

	/**
	 * Creates a plan.
	 *
	 * @param entity The plan as the caller stated it.
	 * @returns The stored plan.
	 * @throws BadRequestException when a stated value is outside its range, or when both a product and
	 * a variant were named.
	 * @throws ConflictException when the organization already holds the code.
	 */
	public async create(entity: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const plan = this.normalize(entity);

		if (!plan.name?.trim()) {
			throw new BadRequestException('A plan must have a name.');
		}

		if (!plan.code?.trim()) {
			throw new BadRequestException('A plan must have a code; it is how the organization names this plan.');
		}

		if (!plan.currency) {
			throw new BadRequestException('A plan must state the currency its amounts are expressed in.');
		}

		await this.assertCodeIsFree(plan.code);

		try {
			return await super.create({ ...plan, tenantId, organizationId } as any);
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw new ConflictException(
					`SUBSCRIPTION_PLAN_CODE_TAKEN: this organization already has a plan coded "${plan.code}".`
				);
			}

			throw error;
		}
	}

	/**
	 * Updates a plan, refusing the changes that would break an agreement already running.
	 *
	 * @param id The plan to update.
	 * @param changes The fields to change.
	 * @returns The updated plan.
	 * @throws BadRequestException when the plan is in use and the code or its active state would move.
	 * @throws NotFoundException when the plan is not the caller's.
	 */
	public async updatePlan(id: ID, changes: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
		const plan = await this.findOneScoped(id);
		const normalized = this.normalize({ ...plan, ...changes } as Partial<SubscriptionPlan>);

		if (changes.code && changes.code !== plan.code) {
			if (await this.hasLiveSubscriptions(id)) {
				throw new BadRequestException(
					'SUBSCRIPTION_PLAN_CODE_IMMUTABLE: a plan with live subscriptions cannot be recoded; the code is what a customer and an invoice quote.'
				);
			}

			await this.assertCodeIsFree(changes.code, id);
		}

		if (changes.isActive === false && plan.isActive !== false && (await this.hasLiveSubscriptions(id))) {
			throw new ConflictException(
				'SUBSCRIPTION_PLAN_HAS_SUBSCRIBERS: this plan still has live subscriptions; they would keep billing, so deactivate it only once they have been moved or cancelled.'
			);
		}

		await super.update(id, this.updatable(normalized) as any);

		return await this.findOneScoped(id);
	}

	/**
	 * Reads a plan inside the caller's tenant and organization.
	 *
	 * @param id The plan to read.
	 * @returns The plan.
	 * @throws NotFoundException when it is not the caller's.
	 */
	public async findOneScoped(id: ID): Promise<SubscriptionPlan> {
		const plan = await this.typeOrmSubscriptionPlanRepository.findOne({
			where: {
				id,
				...currentScope()
			}
		});

		if (!plan) {
			throw new NotFoundException('The subscription plan was not found.');
		}

		return plan;
	}

	/**
	 * Reads a plan by the code the organization knows it by.
	 *
	 * @param code The plan code.
	 * @returns The plan, or null when the organization has no such code.
	 */
	public async findByCode(code: string): Promise<SubscriptionPlan | null> {
		return await this.typeOrmSubscriptionPlanRepository.findOne({
			where: {
				code,
				...currentScope()
			}
		});
	}

	/**
	 * Selects the fields an update may write.
	 *
	 * The identity columns, the tenant, the organization and every lifecycle column belong to the row
	 * and not to the request, so an update is built from the plan's own fields rather than from the
	 * loaded entity spread wholesale — a spread would write `deletedAt: null` back over a
	 * soft-deleted plan and un-delete it as a side effect of editing a price.
	 *
	 * @param plan The normalised plan.
	 * @returns Only the fields that were stated.
	 */
	private updatable(plan: Partial<SubscriptionPlan>): Partial<SubscriptionPlan> {
		return {
			...(plan.name !== undefined ? { name: plan.name } : {}),
			...(plan.code !== undefined ? { code: plan.code } : {}),
			...(plan.description !== undefined ? { description: plan.description } : {}),
			...(plan.productId !== undefined ? { productId: plan.productId } : {}),
			...(plan.variantId !== undefined ? { variantId: plan.variantId } : {}),
			...(plan.billingPeriod !== undefined ? { billingPeriod: plan.billingPeriod } : {}),
			...(plan.billingInterval !== undefined ? { billingInterval: plan.billingInterval } : {}),
			...(plan.maxBillingCycles !== undefined ? { maxBillingCycles: plan.maxBillingCycles } : {}),
			...(plan.trialDays !== undefined ? { trialDays: plan.trialDays } : {}),
			...(plan.setupFee !== undefined ? { setupFee: plan.setupFee } : {}),
			...(plan.discountPercentage !== undefined ? { discountPercentage: plan.discountPercentage } : {}),
			...(plan.currency !== undefined ? { currency: plan.currency } : {}),
			...(plan.isActive !== undefined ? { isActive: plan.isActive } : {}),
			...(plan.metadata !== undefined ? { metadata: plan.metadata } : {})
		};
	}

	/**
	 * @param plan The plan to read the cadence of.
	 * @returns The period and the interval a cycle is computed from.
	 * @throws BadRequestException when the cadence is not one a subscription may bill on.
	 */
	public cadenceOf(plan: ISubscriptionPlan): ISubscriptionCadence {
		const period = plan?.billingPeriod;
		const interval = Math.trunc(Number(plan?.billingInterval ?? 1));

		if (!Object.values(SubscriptionBillingPeriod).includes(period)) {
			throw new BadRequestException(
				`SUBSCRIPTION_PERIOD_UNSUPPORTED: "${period}" is not a recurring billing period.`
			);
		}

		if (!Number.isFinite(interval) || interval < 1) {
			throw new BadRequestException('SUBSCRIPTION_INTERVAL_INVALID: a plan bills every whole period, at least one.');
		}

		return { period, interval };
	}

	/**
	 * Reads a plan and refuses it when it is not currently sellable.
	 *
	 * @param id The plan a subscription is being created from.
	 * @returns The plan.
	 * @throws BadRequestException when the plan is inactive or its catalogue target is not sellable on
	 * a recurring basis.
	 */
	public async assertSubscribeable(id: ID): Promise<SubscriptionPlan> {
		const plan = await this.findOneScoped(id);

		if (plan.isActive === false) {
			throw new BadRequestException(
				`SUBSCRIPTION_PLAN_INACTIVE: the plan "${plan.code}" is not active, so no new subscription may be created from it.`
			);
		}

		await this.assertTargetSellable(plan);

		return plan;
	}

	/**
	 * Resolves the variant a plan delivers.
	 *
	 * A plan that names a variant delivers it. A plan that names only a product delivers the
	 * product's default variant, which the catalogue resolves. A plan that names neither is a pure
	 * service entitlement and delivers nothing the catalogue knows about — which is why the answer is
	 * allowed to be nothing at all.
	 *
	 * @param plan The plan.
	 * @returns The variant to bill, or undefined.
	 */
	public async resolveVariantId(plan: ISubscriptionPlan): Promise<ID | undefined> {
		if (plan?.variantId) {
			return plan.variantId;
		}

		if (plan?.productId && this.catalog) {
			return (await this.catalog.defaultVariantOf(plan.productId)) ?? undefined;
		}

		return undefined;
	}

	/**
	 * @param plan The plan being subscribed to.
	 * @throws BadRequestException when the catalogue, which is registered, refuses the plan's target.
	 */
	public async assertTargetSellable(plan: ISubscriptionPlan): Promise<void> {
		if (!this.catalog) {
			// No catalogue is registered, so there is nothing to ask and nothing to assert: a tenant
			// that sells plans attached to nothing runs the lifecycle on its items alone.
			return;
		}

		if (!plan.productId && !plan.variantId) {
			return;
		}

		const variantId = await this.resolveVariantId(plan);

		if (!variantId) {
			throw new BadRequestException(
				`SUBSCRIPTION_PLAN_TARGET_UNRESOLVED: the plan "${plan.code}" names a catalogue item whose default variant the catalogue did not return.`
			);
		}

		if (!(await this.catalog.isVariantSubscribable(variantId))) {
			throw new BadRequestException(
				`SUBSCRIPTION_VARIANT_NOT_SELLABLE: variant ${variantId} of plan "${plan.code}" is not marked as sellable on a recurring basis.`
			);
		}
	}

	/**
	 * @param planId The plan to count subscribers of.
	 * @returns True when at least one subscription is still live on it.
	 */
	public async hasLiveSubscriptions(planId: ID): Promise<boolean> {
		const count = await this.typeOrmSubscriptionRepository.count({
			where: {
				planId,
				status: In(LIVE_SUBSCRIPTION_STATUSES),
				...currentScope()
			}
		});

		return count > 0;
	}

	/**
	 * @param planId The plan to count live subscriptions of.
	 * @returns How many subscriptions would keep billing if the plan were left alone.
	 */
	public async countLiveSubscriptions(planId: ID): Promise<number> {
		return await this.typeOrmSubscriptionRepository.count({
			where: {
				planId,
				status: In(LIVE_SUBSCRIPTION_STATUSES),
				...currentScope()
			}
		});
	}

	/**
	 * Reads the plans a new subscription may be created from.
	 *
	 * @returns The active plans of the caller's organization.
	 */
	public async listSellable(): Promise<SubscriptionPlan[]> {
		return await this.typeOrmSubscriptionPlanRepository.find({
			where: {
				isActive: true,
				...currentScope()
			},
			order: { name: 'ASC' }
		});
	}

	/**
	 * Normalises a plan's stated values onto the shapes their columns hold.
	 *
	 * @param entity The plan as it was stated.
	 * @returns The plan with its decimals and its cadence normalised.
	 * @throws BadRequestException when a stated value is outside its range.
	 */
	private normalize(entity: Partial<SubscriptionPlan>): Partial<SubscriptionPlan> {
		const plan: Partial<SubscriptionPlan> = { ...entity };

		if (plan.productId && plan.variantId) {
			throw new BadRequestException(
				'SUBSCRIPTION_PLAN_TARGET_AMBIGUOUS: a plan is attached to a product or to one variant, not to both; a plan attached to neither is a service entitlement.'
			);
		}

		if (plan.billingInterval !== undefined && plan.billingInterval !== null) {
			const interval = Number(plan.billingInterval);

			if (!Number.isInteger(interval) || interval < 1) {
				throw new BadRequestException('SUBSCRIPTION_INTERVAL_INVALID: billingInterval counts whole periods and is at least one.');
			}

			plan.billingInterval = interval;
		}

		if (plan.maxBillingCycles !== undefined && plan.maxBillingCycles !== null) {
			const cycles = Number(plan.maxBillingCycles);

			if (!Number.isInteger(cycles) || cycles < 1) {
				throw new BadRequestException('SUBSCRIPTION_MAX_CYCLES_INVALID: maxBillingCycles is a whole number of cycles, at least one.');
			}

			plan.maxBillingCycles = cycles;
		}

		if (plan.trialDays !== undefined && plan.trialDays !== null) {
			const trialDays = Number(plan.trialDays);

			if (!Number.isInteger(trialDays) || trialDays < 0) {
				throw new BadRequestException('SUBSCRIPTION_TRIAL_INVALID: trialDays is a whole number of days and cannot be negative.');
			}

			plan.trialDays = trialDays;
		}

		if (plan.setupFee !== undefined && plan.setupFee !== null && String(plan.setupFee) !== '') {
			plan.setupFee = this.normalizeAmount(plan.setupFee, plan.currency);
		}

		if (plan.discountPercentage !== undefined && plan.discountPercentage !== null && String(plan.discountPercentage) !== '') {
			try {
				plan.discountPercentage = normalizeDiscountFraction(plan.discountPercentage) as any;
			} catch (error) {
				throw new BadRequestException((error as Error).message);
			}
		}

		return plan;
	}

	/**
	 * @param amount A stated amount.
	 * @param currency The currency it is expressed in.
	 * @returns The amount at the money layer's storage scale, or undefined when none was stated.
	 * @throws BadRequestException when the amount is negative or is not an exact decimal.
	 */
	private normalizeAmount(amount: string | number, currency?: string): any {
		if (!currency) {
			throw new BadRequestException('A plan must state the currency its amounts are expressed in.');
		}

		try {
			const money = Money.of(normalizeDecimal(amount, '0'), currency).round();

			if (money.isNegative()) {
				throw new BadRequestException('SUBSCRIPTION_AMOUNT_INVALID: a plan amount cannot be negative.');
			}

			return money.toStorageString();
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`SUBSCRIPTION_AMOUNT_INVALID: ${(error as Error).message}`);
		}
	}

	/**
	 * @param code The code being claimed.
	 * @param exceptId A plan id to ignore, when an existing plan is being edited.
	 * @throws ConflictException when the organization already holds the code.
	 */
	private async assertCodeIsFree(code: string, exceptId?: ID): Promise<void> {
		const existing = await this.findByCode(code);

		if (existing && existing.id !== exceptId) {
			throw new ConflictException(
				`SUBSCRIPTION_PLAN_CODE_TAKEN: this organization already has a plan coded "${code}".`
			);
		}
	}
}
