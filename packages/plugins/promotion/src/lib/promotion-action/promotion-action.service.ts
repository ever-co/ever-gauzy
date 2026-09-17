import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { CrudService, RequestContext } from '@gauzy/core';
import { PromotionAction } from './promotion-action.entity';
import { TypeOrmPromotionActionRepository } from './repository/type-orm-promotion-action.repository';
import { MikroOrmPromotionActionRepository } from './repository/mikro-orm-promotion-action.repository';
import {
	IPromotionAction,
	PromotionActionAllocation,
	PromotionActionTargetType,
	PromotionActionType,
	PromotionType
} from '../promotion.types';

/**
 * The effect half of a promotion.
 *
 * The service owns the validation matrix, and it is a matrix rather than a set of loose checks
 * because the legality of one column depends on another: an `EACH` action without a quantity cap is
 * unbounded, an order-scoped action cannot allocate per unit, and a fixed amount without a currency
 * would be applied to whatever currency the cart happens to be in. Every violation is refused at
 * write time and re-asserted at evaluation time, because an action can also become illegal when the
 * promotion around it changes type.
 */
@Injectable()
export class PromotionActionService extends CrudService<PromotionAction> {
	constructor(
		readonly typeOrmPromotionActionRepository: TypeOrmPromotionActionRepository,
		readonly mikroOrmPromotionActionRepository: MikroOrmPromotionActionRepository
	) {
		super(typeOrmPromotionActionRepository, mikroOrmPromotionActionRepository);
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
	 * Which action types a promotion type admits.
	 */
	private static readonly LEGAL_ACTIONS: Record<PromotionType, PromotionActionType[]> = {
		[PromotionType.STANDARD]: [
			PromotionActionType.FIXED,
			PromotionActionType.PERCENTAGE,
			PromotionActionType.TIERED_PERCENTAGE,
			PromotionActionType.FREE_SHIPPING
		],
		[PromotionType.BUY_GET]: [
			PromotionActionType.PERCENTAGE,
			PromotionActionType.FIXED,
			PromotionActionType.FREE_ITEM
		],
		[PromotionType.FREE_SHIPPING]: [PromotionActionType.FREE_SHIPPING],
		[PromotionType.BUNDLE]: [PromotionActionType.BUNDLE_PRICE],
		[PromotionType.FREE_ITEM]: [PromotionActionType.FREE_ITEM]
	};

	/**
	 * Validates one action against its promotion type.
	 *
	 * @param action The action to validate.
	 * @param promotionType The type of the promotion it belongs to.
	 * @throws BadRequestException with the code of the rule that was broken.
	 */
	assertValid(action: Partial<IPromotionAction>, promotionType: PromotionType): void {
		const legal = PromotionActionService.LEGAL_ACTIONS[promotionType] ?? [];

		if (action.type && !legal.includes(action.type)) {
			throw new BadRequestException(
				`PROMOTION_NOT_APPLICABLE: a ${promotionType} promotion cannot carry a ${action.type} action.`
			);
		}

		if (action.targetType === PromotionActionTargetType.ORDER && action.allocation !== undefined && action.allocation !== PromotionActionAllocation.ACROSS) {
			throw new BadRequestException('ACTION_ALLOCATION_NOT_ALLOWED: an order-scoped action is always spread ACROSS.');
		}

		if (action.targetType === PromotionActionTargetType.SHIPPING && action.type !== PromotionActionType.FREE_SHIPPING && action.type !== PromotionActionType.FIXED) {
			throw new BadRequestException('ACTION_ALLOCATION_NOT_ALLOWED: only a free-shipping or fixed action may target shipping.');
		}

		if (action.allocation === PromotionActionAllocation.EACH && !action.maxQuantity) {
			throw new BadRequestException(
				'ACTION_MAX_QUANTITY_REQUIRED: an EACH action is unbounded without a maximum quantity.'
			);
		}

		const percentage =
			action.type === PromotionActionType.PERCENTAGE || action.type === PromotionActionType.TIERED_PERCENTAGE;

		if (percentage && action.value !== undefined) {
			const value = Number(action.value);

			if (!(value > 0) || value > 100) {
				throw new BadRequestException('ACTION_TIERS_INVALID: a percentage is a number in (0, 100].');
			}
		}

		if (action.type === PromotionActionType.TIERED_PERCENTAGE) {
			this.assertTiers(action.metadata);
		}

		const fixed =
			action.type === PromotionActionType.FIXED ||
			action.type === PromotionActionType.BUNDLE_PRICE ||
			action.type === PromotionActionType.FREE_SHIPPING;

		if (fixed && !action.currency) {
			throw new BadRequestException(
				'CURRENCY_MISMATCH: a fixed-amount action carries its currency, so it cannot be applied to another one.'
			);
		}

		if (action.type === PromotionActionType.BUNDLE_PRICE) {
			const bundleSize = Number((action.metadata as { bundleSize?: number } | undefined)?.bundleSize ?? 0);

			if (!Number.isInteger(bundleSize) || bundleSize < 2) {
				throw new BadRequestException('ACTION_TIERS_INVALID: a bundle price needs a bundle size of at least two.');
			}
		}
	}

	/**
	 * Replaces the whole action set of a promotion.
	 *
	 * A replacement rather than a merge, because the positions of the actions are what decide how their
	 * discounts compose: merging would leave an operator unable to remove an action without also
	 * renumbering the ones that remain.
	 *
	 * @param promotionId The promotion whose actions are replaced.
	 * @param actions The new action set.
	 * @param promotionType The type of the promotion, which bounds the legal action types.
	 * @returns The stored actions, in application order.
	 * @throws BadRequestException when the set is empty.
	 */
	async replaceActions(
		promotionId: ID,
		actions: Partial<IPromotionAction>[],
		promotionType: PromotionType
	): Promise<IPromotionAction[]> {
		if (!actions?.length) {
			throw new BadRequestException('PROMOTION_NO_ACTIONS: a promotion without an action has no effect.');
		}

		for (const action of actions) {
			this.assertValid(action, promotionType);
		}

		await this.typeOrmPromotionActionRepository.delete({ promotionId, ...this.scope });

		const stored: IPromotionAction[] = [];

		for (const [index, action] of actions.entries()) {
			stored.push(
				await this.create({
					...action,
					promotionId,
					position: action.position ?? index,
					...this.scope
				} as never)
			);
		}

		return stored;
	}

	/**
	 * Reads the action set of a promotion in application order.
	 *
	 * @param promotionId The promotion to read.
	 * @returns The actions.
	 */
	async findByPromotion(promotionId: ID): Promise<IPromotionAction[]> {
		const rows = await this.typeOrmPromotionActionRepository.find({
			where: { promotionId, ...this.scope },
			order: { position: 'ASC' }
		});

		return rows as unknown as IPromotionAction[];
	}

	/**
	 * Loads one action of the caller's organization.
	 *
	 * @param id The action to load.
	 * @returns The action.
	 * @throws NotFoundException when it is not in the caller's scope.
	 */
	async findActionOrFail(id: ID): Promise<IPromotionAction> {
		const action = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!action) {
			throw new NotFoundException('PROMOTION_NOT_FOUND: no action with that identifier.');
		}

		return action;
	}

	/**
	 * Checks the tier list of a tiered percentage: at least one tier, strictly increasing thresholds
	 * and a percentage in `(0, 100]` on each.
	 *
	 * @param metadata The action's metadata.
	 * @throws BadRequestException when the tier list is unusable.
	 */
	private assertTiers(metadata: Record<string, unknown> | undefined): void {
		const tiers = (metadata as { tiers?: Array<{ threshold?: unknown; percent?: unknown }> } | undefined)?.tiers;

		if (!Array.isArray(tiers) || tiers.length === 0) {
			throw new BadRequestException('ACTION_TIERS_INVALID: a tiered percentage needs at least one tier.');
		}

		let previous = -Infinity;

		for (const tier of tiers) {
			const threshold = Number(tier?.threshold);
			const percent = Number(tier?.percent);

			if (!Number.isFinite(threshold) || threshold <= previous) {
				throw new BadRequestException('ACTION_TIERS_INVALID: thresholds must be strictly increasing.');
			}

			if (!(percent > 0) || percent > 100) {
				throw new BadRequestException('ACTION_TIERS_INVALID: a tier percentage is a number in (0, 100].');
			}

			previous = threshold;
		}
	}
}
