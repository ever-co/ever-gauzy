import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PromotionActionService } from './promotion-action.service';
import { PromotionActionAllocation, PromotionActionTargetType, PromotionActionType, PromotionType } from '../promotion.types';

/**
 * The legality matrix of a promotion's effect.
 *
 * The matrix exists because the legality of one column depends on another — an `EACH` allocation
 * without a quantity cap is unbounded, an order-scoped action cannot allocate per unit, and a fixed
 * amount without a currency would be applied to whatever currency the cart happens to be in — and
 * because every violation caught here is a discount that cannot be given away by accident.
 *
 * Each rule is asserted in both directions: the illegal shape is refused *and* the same shape is
 * accepted where it is legal, so a validator that refused everything would not pass.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const PROMOTION = '00000000-0000-4000-8000-0000000000a0';

interface IActionRow {
	id: string;
	tenantId: string;
	organizationId: string;
	promotionId: string;
	type: PromotionActionType;
	targetType: PromotionActionTargetType;
	allocation: PromotionActionAllocation;
	value: string;
	currency?: string;
	maxQuantity?: string;
	isTaxInclusive: boolean;
	position: number;
	metadata?: Record<string, unknown>;
}

function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value as unknown[])?.some((one) => String(one) === String(value));
				case 'isNull':
					return value === null || value === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		return expected === undefined || String(expected ?? '') === String(value ?? '');
	});
}

function world(actions: IActionRow[] = []) {
	const deleted: string[] = [];

	const repository = {
		find: async (options?: { where?: Record<string, unknown>; order?: unknown }) =>
			actions
				.filter((row) => matches(row, options?.where))
				.sort((left, right) => left.position - right.position),
		findOneBy: async (where?: Record<string, unknown>) => actions.filter((row) => matches(row, where))[0] ?? null,
		delete: async (where: Record<string, unknown>) => {
			deleted.push(String(where.promotionId));

			return { affected: 1 };
		},
		create: (partial: IActionRow) => ({ id: `act-${actions.length + 1}`, ...partial }),
		save: async (entity: IActionRow) => {
			actions.push(entity);

			return entity;
		}
	};

	return { actions, deleted, service: new PromotionActionService(repository as never, {} as never) };
}

describe('PromotionActionService.assertValid — what a promotion type admits (doc 08 §10.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('admits only the actions a promotion type can carry', () => {
		const { service } = world();

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.BUNDLE_PRICE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '50.000000',
					currency: 'USD',
					metadata: { bundleSize: 3 }
				},
				PromotionType.BUNDLE
			)
		).not.toThrow();

		// The same action on a plain discount is not applicable.
		expect(() =>
			service.assertValid(
				{ type: PromotionActionType.BUNDLE_PRICE, targetType: PromotionActionTargetType.ITEMS, value: '50.000000', currency: 'USD' },
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);

		// A free-shipping promotion carries nothing else, and a free-item promotion gives items away.
		expect(() =>
			service.assertValid(
				{ type: PromotionActionType.PERCENTAGE, value: '10', targetType: PromotionActionTargetType.ORDER },
				PromotionType.FREE_SHIPPING
			)
		).toThrow(BadRequestException);
		expect(() =>
			service.assertValid(
				{ type: PromotionActionType.FREE_ITEM, targetType: PromotionActionTargetType.ITEMS, value: '1' },
				PromotionType.BUY_GET
			)
		).not.toThrow();
	});

	it('keeps an unbounded per-unit allocation out of the catalogue', () => {
		// An `EACH` action without a maximum quantity is unbounded, so it can never be written.
		const { service } = world();

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.EACH,
					value: '10'
				},
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.EACH,
					value: '10',
					maxQuantity: '2'
				},
				PromotionType.STANDARD
			)
		).not.toThrow();
	});

	it('spreads an order-scoped action across the order and never per unit', () => {
		const { service } = world();

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.FIXED,
					targetType: PromotionActionTargetType.ORDER,
					allocation: PromotionActionAllocation.EACH,
					value: '5.000000',
					currency: 'USD',
					maxQuantity: '2'
				},
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);
	});

	it('lets only a free-shipping or fixed action target shipping', () => {
		const { service } = world();

		expect(() =>
			service.assertValid(
				{ type: PromotionActionType.PERCENTAGE, targetType: PromotionActionTargetType.SHIPPING, value: '10' },
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.FREE_SHIPPING,
					targetType: PromotionActionTargetType.SHIPPING,
					allocation: PromotionActionAllocation.ACROSS,
					value: '14.950000',
					currency: 'USD'
				},
				PromotionType.FREE_SHIPPING
			)
		).not.toThrow();
	});

	it('holds a percentage inside one and a hundred', () => {
		// A percentage of zero discounts nothing and one above a hundred gives money away.
		const { service } = world();
		const percentage = (value: string) => ({
			type: PromotionActionType.PERCENTAGE,
			targetType: PromotionActionTargetType.ORDER,
			allocation: PromotionActionAllocation.ACROSS,
			value
		});

		for (const value of ['0', '-5', '100.5', '150']) {
			expect(() => service.assertValid(percentage(value), PromotionType.STANDARD)).toThrow(BadRequestException);
		}

		expect(() => service.assertValid(percentage('100'), PromotionType.STANDARD)).not.toThrow();
		expect(() => service.assertValid(percentage('0.5'), PromotionType.STANDARD)).not.toThrow();
	});

	it('requires a currency on a fixed amount, so it cannot be applied to another currency', () => {
		const { service } = world();

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.FIXED,
					targetType: PromotionActionTargetType.ORDER,
					allocation: PromotionActionAllocation.ACROSS,
					value: '15.000000'
				},
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);

		expect(() =>
			service.assertValid(
				{
					type: PromotionActionType.FIXED,
					targetType: PromotionActionTargetType.ORDER,
					allocation: PromotionActionAllocation.ACROSS,
					value: '15.000000',
					currency: 'USD'
				},
				PromotionType.STANDARD
			)
		).not.toThrow();
	});

	it('requires a bundle of at least two items to carry a bundle price', () => {
		const { service } = world();
		const bundle = (bundleSize: number) => ({
			type: PromotionActionType.BUNDLE_PRICE,
			targetType: PromotionActionTargetType.ITEMS,
			allocation: PromotionActionAllocation.ONCE,
			value: '30.000000',
			currency: 'USD',
			metadata: { bundleSize }
		});

		expect(() => service.assertValid(bundle(1), PromotionType.BUNDLE)).toThrow(BadRequestException);
		expect(() => service.assertValid(bundle(2), PromotionType.BUNDLE)).not.toThrow();
	});

	it('requires a tiered percentage to have strictly increasing tiers of usable percentages', () => {
		const { service } = world();
		const tiered = (tiers: Array<{ threshold: number; percent: number }>) => ({
			type: PromotionActionType.TIERED_PERCENTAGE,
			targetType: PromotionActionTargetType.ORDER,
			allocation: PromotionActionAllocation.ACROSS,
			value: '10',
			metadata: { tiers }
		});

		expect(() => service.assertValid(tiered([]), PromotionType.STANDARD)).toThrow(BadRequestException);
		expect(() =>
			service.assertValid(
				tiered([
					{ threshold: 100, percent: 10 },
					{ threshold: 50, percent: 15 }
				]),
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);
		expect(() =>
			service.assertValid(
				tiered([
					{ threshold: 100, percent: 10 },
					{ threshold: 100, percent: 15 }
				]),
				PromotionType.STANDARD
			)
		).toThrow(BadRequestException);
		expect(() =>
			service.assertValid(tiered([{ threshold: 100, percent: 0 }]), PromotionType.STANDARD)
		).toThrow(BadRequestException);
		expect(() =>
			service.assertValid(
				tiered([
					{ threshold: 100, percent: 10 },
					{ threshold: 250, percent: 15 }
				]),
				PromotionType.STANDARD
			)
		).not.toThrow();
	});
});

describe('PromotionActionService.replaceActions — the whole set, in order (doc 08 §10.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a promotion with no action at all', async () => {
		// A promotion without an effect has nothing to apply, so it can never be published.
		const { service } = world();

		await expect(service.replaceActions(PROMOTION, [], PromotionType.STANDARD)).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('replaces the set rather than merging it, and numbers the actions in the order given', async () => {
		// Merging would leave an operator unable to remove an action; the positions decide how the
		// discounts compose, so they follow the order the caller stated.
		const { service, actions, deleted } = world();

		const stored = await service.replaceActions(
			PROMOTION,
			[
				{ type: PromotionActionType.PERCENTAGE, targetType: PromotionActionTargetType.ITEMS, allocation: PromotionActionAllocation.ONCE, value: '10' },
				{ type: PromotionActionType.FIXED, targetType: PromotionActionTargetType.ORDER, allocation: PromotionActionAllocation.ACROSS, value: '5.000000', currency: 'USD' }
			],
			PromotionType.STANDARD
		);

		expect(deleted).toEqual([PROMOTION]);
		expect(stored.map((row) => row.position)).toEqual([0, 1]);
		expect(stored.map((row) => row.type)).toEqual(['PERCENTAGE', 'FIXED']);
		expect(actions).toHaveLength(2);
	});

	it('refuses the whole set when one action of it is illegal', async () => {
		const { service, actions } = world();

		await expect(
			service.replaceActions(
				PROMOTION,
				[
					{ type: PromotionActionType.PERCENTAGE, targetType: PromotionActionTargetType.ORDER, allocation: PromotionActionAllocation.ACROSS, value: '10' },
					{ type: PromotionActionType.BUNDLE_PRICE, targetType: PromotionActionTargetType.ITEMS, value: '30.000000', currency: 'USD' }
				],
				PromotionType.STANDARD
			)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(actions).toEqual([]);
	});
});
