import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { PromotionController } from './promotion.controller';
import { PromotionResolver } from '../graphql/resolvers/promotion.resolver';
import { PromotionPermission } from '../promotion.permissions';
import { PromotionStatus } from '../promotion.types';
import { assertMayPublishOnCreate } from './promotion-publish';

/**
 * R2-G29: `createPromotion` with `actions` (and `status: ACTIVE`) published a live discount under `PROMOTIONS_CREATE`
 * alone, while giving a promotion its actions and starting it are `PROMOTIONS_EDIT` on both surfaces. A create that
 * publishes now needs both grants; a draft is unchanged.
 */
describe('a create that publishes a discount needs PROMOTIONS_EDIT (R2-G29)', () => {
	const ACTION = { type: 'PERCENTAGE', targetType: 'ITEMS', value: '10' };

	/** The caller holds exactly these grants. */
	function grants(...held: string[]) {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => held.includes(permission));
	}

	function surfaces() {
		const service = {
			createPromotion: jest.fn(async (input: unknown) => ({ id: 'promo-1', ...(input as object) }))
		};

		return {
			service,
			controller: new PromotionController(service as never),
			resolver: new PromotionResolver(
				service as never,
				{} as never,
				{} as never,
				{} as never,
				{} as never,
				{} as never
			)
		};
	}

	afterEach(() => jest.restoreAllMocks());

	it('refuses an action set or the ACTIVE status to a caller who may only create, and writes nothing', async () => {
		grants(PromotionPermission.PROMOTIONS_CREATE);
		const { service, resolver, controller } = surfaces();

		const withActions = await resolver.createPromotion({ title: 'Live', actions: [ACTION] } as never);
		const active = await resolver.createPromotion({ title: 'Live', status: PromotionStatus.ACTIVE } as never);

		expect(withActions.promotion).toBeNull();
		expect(withActions.userErrors).toEqual([expect.objectContaining({ code: 'PROMOTION_PUBLISH_FORBIDDEN' })]);
		expect(active.userErrors).toEqual([expect.objectContaining({ code: 'PROMOTION_PUBLISH_FORBIDDEN' })]);

		await expect(
			controller.create({ title: 'Live', status: PromotionStatus.ACTIVE } as never)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(service.createPromotion).not.toHaveBeenCalled();
	});

	it('still creates a draft under PROMOTIONS_CREATE alone, on both surfaces', async () => {
		grants(PromotionPermission.PROMOTIONS_CREATE);
		const { service, resolver, controller } = surfaces();

		const created = await resolver.createPromotion({ title: 'Draft', actions: [] } as never);
		await controller.create({ title: 'Draft', status: PromotionStatus.DRAFT } as never);

		expect(created.userErrors).toEqual([]);
		expect(service.createPromotion).toHaveBeenCalledTimes(2);
	});

	it('publishes in one call for a caller who may also edit', async () => {
		grants(PromotionPermission.PROMOTIONS_CREATE, PromotionPermission.PROMOTIONS_EDIT);
		const { service, resolver } = surfaces();

		const created = await resolver.createPromotion({
			title: 'Live',
			status: PromotionStatus.ACTIVE,
			actions: [ACTION]
		} as never);

		expect(created.userErrors).toEqual([]);
		expect(service.createPromotion).toHaveBeenCalledTimes(1);
	});

	it('publishes an ACTIVE promotion on REST for a caller who may also edit', async () => {
		grants(PromotionPermission.PROMOTIONS_CREATE, PromotionPermission.PROMOTIONS_EDIT);
		const { service, controller } = surfaces();

		await expect(controller.create({ title: 'Live', status: PromotionStatus.ACTIVE } as never)).resolves.toEqual(
			expect.objectContaining({ status: PromotionStatus.ACTIVE })
		);
		expect(service.createPromotion).toHaveBeenCalledTimes(1);
	});

	it('names what published in the refusal', () => {
		grants();

		expect(() => assertMayPublishOnCreate({ actions: [ACTION], status: PromotionStatus.ACTIVE })).toThrow(
			/an action set and the ACTIVE status/
		);
		expect(() => assertMayPublishOnCreate({ status: PromotionStatus.DRAFT })).not.toThrow();
		expect(() => assertMayPublishOnCreate(undefined)).not.toThrow();
	});
});
