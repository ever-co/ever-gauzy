import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { ID, IPagination, ShippingPriceType } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { ShippingOption } from './shipping-option.entity';
import { TypeOrmShippingOptionRepository } from './repository/type-orm-shipping-option.repository';
import { MikroOrmShippingOptionRepository } from './repository/mikro-orm-shipping-option.repository';

/**
 * What a caller asks for when it wants to know which deliveries are available.
 */
export interface IShippingEligibilityContext {
	/** The channel the cart belongs to. An option with no channel is offered on every channel. */
	readonly channelId?: ID;
	/** The region. An option with no region serves every region. */
	readonly regionId?: ID;
	/** The profile ids of the variants in the cart, which is what decides whether a courier is offered. */
	readonly profileIds?: ID[];
	/** The total weight of the shippable lines. */
	readonly totalWeight?: number;
	/** How many shippable items the cart holds. */
	readonly itemCount?: number;
	/** The order value, for the rules that band on it. */
	readonly orderTotal?: number;
}

/**
 * An option together with why it is or is not available.
 */
export interface IShippingOptionEligibility {
	readonly option: ShippingOption;
	readonly eligible: boolean;
	readonly reason?: string;
}

/**
 * The configured, sellable delivery choices.
 *
 * The three price shapes are each held to their own rule here, because a flat option without an amount
 * and a calculated option without a strategy are not configurations with a defect — they are options
 * that would silently charge zero or fail at checkout. Eligibility itself is decided by the core rule
 * engine (`ownerType = SHIPPING_OPTION`); what this service adds is the part a rule cannot know: the
 * option's own physical limits and its channel, region and profile scope.
 */
@Injectable()
export class ShippingOptionService extends TenantAwareCrudService<ShippingOption> {
	constructor(
		readonly typeOrmShippingOptionRepository: TypeOrmShippingOptionRepository,
		readonly mikroOrmShippingOptionRepository: MikroOrmShippingOptionRepository
	) {
		super(typeOrmShippingOptionRepository, mikroOrmShippingOptionRepository);
	}

	/**
	 * Creates an option, refusing a shape its price type does not allow.
	 *
	 * @param entity The option to create.
	 * @returns The created option.
	 */
	public async create(entity: DeepPartial<ShippingOption>): Promise<ShippingOption> {
		this.assertPriceShape(entity);
		await this.assertCodeIsFree(entity.code);

		return super.create(entity);
	}

	/**
	 * Updates an option, keeping the price shape coherent and bumping its optimistic lock.
	 *
	 * @param id The option.
	 * @param entity The fields to change.
	 * @returns The update result or the option.
	 */
	public async update(id: any, entity: any): Promise<any> {
		const existing = await this.findOneByIdString(id as ID);

		if (!existing) {
			throw new NotFoundException(`SHIPPING_OPTION_NOT_FOUND: no option exists with id ${id}.`);
		}

		this.assertPriceShape({ ...existing, ...entity } as DeepPartial<ShippingOption>);

		if (entity?.code) {
			await this.assertCodeIsFree(entity.code, id as ID);
		}

		return super.update(id, { ...entity, version: Number(existing.version ?? 1) + 1 });
	}

	/**
	 * Returns the options a cart context may choose between, each with the reason it is or is not
	 * available.
	 *
	 * The caller decides what to show: an ineligible option is returned with its reason rather than
	 * dropped, because "why is there no express delivery to my address?" is a question the answer to
	 * which is the reason string.
	 *
	 * @param context What the cart looks like.
	 * @returns The options, ordered by priority.
	 */
	public async findEligible(context: IShippingEligibilityContext): Promise<IShippingOptionEligibility[]> {
		const options = (await this.findAll({})) as IPagination<ShippingOption>;
		const results: IShippingOptionEligibility[] = [];

		for (const option of options.items) {
			results.push({ option, ...this.eligibilityOf(option, context) });
		}

		return results.sort((left, right) => Number(left.option.priority) - Number(right.option.priority));
	}

	/**
	 * Prices one option for a context.
	 *
	 * A flat option's price is its stated amount; a free option's is zero; a calculated option is priced
	 * by the strategy its `providerKey` names, which is resolved by the checkout rather than here — this
	 * method returns the option's own answer and names the strategy to call.
	 *
	 * @param optionId The option.
	 * @param context What the cart looks like.
	 * @returns The amount, its currency, and the strategy that must be called when one is needed.
	 */
	public async calculate(
		optionId: ID,
		context: IShippingEligibilityContext
	): Promise<{ amount: number; currency?: string; providerKey?: string; eligible: boolean; reason?: string }> {
		const option = await this.findOneByIdString(optionId);

		if (!option) {
			throw new NotFoundException(`SHIPPING_OPTION_NOT_FOUND: no option exists with id ${optionId}.`);
		}

		const eligibility = this.eligibilityOf(option, context);

		if (!eligibility.eligible) {
			return { amount: 0, currency: option.currency, eligible: false, reason: eligibility.reason };
		}

		switch (option.priceType) {
			case ShippingPriceType.FREE:
				return { amount: 0, currency: option.currency, eligible: true };
			case ShippingPriceType.CALCULATED:
				return {
					amount: 0,
					currency: option.currency,
					providerKey: option.providerKey,
					eligible: true,
					reason: 'CALCULATED_BY_STRATEGY'
				};
			default:
				return { amount: Number(option.amount ?? 0), currency: option.currency, eligible: true };
		}
	}

	/**
	 * @param option The option.
	 * @param context What the cart looks like.
	 * @returns Whether the option is available, and why not when it is not.
	 */
	private eligibilityOf(
		option: ShippingOption,
		context: IShippingEligibilityContext
	): { eligible: boolean; reason?: string } {
		if (option.isActive === false) {
			return { eligible: false, reason: 'SHIPPING_OPTION_INACTIVE' };
		}

		if (option.channelId && context.channelId && option.channelId !== context.channelId) {
			return { eligible: false, reason: 'SHIPPING_OPTION_CHANNEL_MISMATCH' };
		}

		if (option.regionId && context.regionId && option.regionId !== context.regionId) {
			return { eligible: false, reason: 'SHIPPING_OPTION_REGION_MISMATCH' };
		}

		if (option.profileId && context.profileIds?.length && !context.profileIds.includes(option.profileId)) {
			return { eligible: false, reason: 'SHIPPING_OPTION_PROFILE_MISMATCH' };
		}

		if (option.maxWeight !== null && option.maxWeight !== undefined) {
			if (context.totalWeight !== undefined && context.totalWeight > Number(option.maxWeight)) {
				return { eligible: false, reason: 'SHIPPING_OPTION_WEIGHT_EXCEEDED' };
			}
		}

		if (option.maxItemCount !== null && option.maxItemCount !== undefined) {
			if (context.itemCount !== undefined && context.itemCount > Number(option.maxItemCount)) {
				return { eligible: false, reason: 'SHIPPING_OPTION_ITEM_COUNT_EXCEEDED' };
			}
		}

		return { eligible: true };
	}

	/**
	 * Holds an option to the shape its price type allows.
	 *
	 * @param entity The option.
	 */
	private assertPriceShape(entity: DeepPartial<ShippingOption>): void {
		switch (entity.priceType) {
			case ShippingPriceType.FLAT:
				if (entity.amount === null || entity.amount === undefined || !entity.currency) {
					throw new BadRequestException({
						message: 'A flat shipping option needs an amount and a currency.',
						code: 'SHIPPING_OPTION_INVALID',
						details: { priceType: entity.priceType }
					});
				}
				break;
			case ShippingPriceType.CALCULATED:
				if (!entity.providerKey) {
					throw new BadRequestException({
						message: 'A calculated shipping option needs the provider strategy that prices it.',
						code: 'SHIPPING_OPTION_INVALID',
						details: { priceType: entity.priceType }
					});
				}
				break;
			case ShippingPriceType.FREE:
				break;
			default:
				throw new BadRequestException({
					message: 'A shipping option needs a price type.',
					code: 'SHIPPING_OPTION_INVALID',
					details: { priceType: entity.priceType }
				});
		}

		if (
			entity.estimatedMinDays !== null &&
			entity.estimatedMinDays !== undefined &&
			entity.estimatedMaxDays !== null &&
			entity.estimatedMaxDays !== undefined &&
			Number(entity.estimatedMinDays) > Number(entity.estimatedMaxDays)
		) {
			throw new BadRequestException({
				message: 'A delivery estimate cannot end before it starts.',
				code: 'SHIPPING_OPTION_INVALID',
				details: { estimatedMinDays: entity.estimatedMinDays, estimatedMaxDays: entity.estimatedMaxDays }
			});
		}
	}

	/**
	 * @param code The code to test.
	 * @param exceptId An option to exclude from the test, when updating.
	 */
	private async assertCodeIsFree(code: string, exceptId?: ID): Promise<void> {
		if (!code) {
			throw new BadRequestException('SHIPPING_OPTION_CODE_REQUIRED: a shipping option needs a code.');
		}

		const existing = (await this.findOneByWhereOptions({ code } as FindOptionsWhere<ShippingOption>)) as
			| ShippingOption
			| null;

		if (existing && existing.id !== exceptId) {
			throw new BadRequestException({
				message: `SHIPPING_OPTION_CODE_TAKEN: an option with code ${code} already exists.`,
				code: 'SHIPPING_OPTION_CODE_TAKEN',
				details: { code, optionId: existing.id }
			});
		}
	}
}
