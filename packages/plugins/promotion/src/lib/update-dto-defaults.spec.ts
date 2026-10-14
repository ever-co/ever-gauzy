/**
 * An update body reaches the service holding what the client sent and nothing else (review R3-05).
 *
 * The mapped types' constructor copies every field initializer of the DTO it maps, and a `ValidationPipe` builds
 * the body with that constructor, so a partial `PUT` used to arrive carrying the create DTO's defaults and wrote
 * them back: `PUT /promotions/:id {"title":"Summer"}` set an `ACTIVE` promotion back to `DRAFT` with
 * `usageCount 0`, `PUT /coupons/:id` let a used-up single-use coupon validate again, `PUT /campaigns/:id` reset the
 * status, `PUT /campaign-budgets/:id` flipped a `USAGE` budget to `SPEND`, `PUT /promotion-usages/:id` turned a
 * `REVERTED` usage back to `RESERVED`, `PUT /promotion-actions/:id` turned an item action into an order one and
 * `PUT /gift-cards/:id` reactivated a cancelled card. This suite runs each update body through the pipe exactly as
 * its route mounts it.
 *
 * `@gauzy/core` is doubled for the reason the package's other specs give (its barrel boots the application graph);
 * `WithoutInitializers` - the one piece this suite is about - comes from `@gauzy/common`, real.
 */
jest.mock('@gauzy/core', () => ({
	TenantOrganizationBaseDTO: class {}
}));

import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateCampaignBudgetDTO } from './campaign-budget/dto';
import { UpdateCampaignDTO } from './campaign/dto';
import { UpdateCouponDTO } from './coupon/dto';
import { UpdateGiftCardDTO } from './gift-card/dto';
import { UpdatePromotionActionDTO } from './promotion-action/dto';
import { UpdatePromotionUsageDTO } from './promotion-usage/dto';
import { UpdatePromotionDTO } from './promotion/dto';

/** The pipe these routes mount: `@UseValidationPipe({ transform: true, whitelist: true })`. */
const pipe = new ValidationPipe({ transform: true, whitelist: true });

/** What the handler receives for `body`, as the route's pipe hands it over. */
async function received(metatype: ArgumentMetadata['metatype'], body: Record<string, unknown>) {
	return pipe.transform({ ...body }, { type: 'body', metatype });
}

const BODIES: Array<[string, ArgumentMetadata['metatype'], Record<string, unknown>]> = [
	['UpdatePromotionDTO (PUT /promotions/:id)', UpdatePromotionDTO, { title: 'Summer' }],
	['UpdateCouponDTO (PUT /coupons/:id)', UpdateCouponDTO, { code: 'SUMMER10' }],
	['UpdateCampaignDTO (PUT /campaigns/:id)', UpdateCampaignDTO, { name: 'Summer sale' }],
	['UpdateCampaignBudgetDTO (PUT /campaign-budgets/:id)', UpdateCampaignBudgetDTO, { limit: '500.00' }],
	['UpdatePromotionUsageDTO (PUT /promotion-usages/:id)', UpdatePromotionUsageDTO, { code: 'SUMMER10' }],
	['UpdatePromotionActionDTO (PUT /promotion-actions/:id)', UpdatePromotionActionDTO, { value: '10' }],
	['UpdateGiftCardDTO (PUT /gift-cards/:id)', UpdateGiftCardDTO, { expiresAt: new Date('2027-01-01T00:00:00.000Z') }]
];

describe('promotion update bodies carry only what the client sent', () => {
	it.each(BODIES)('%s', async (_name, metatype, body) => {
		expect({ ...(await received(metatype, body)) }).toEqual(body);
	});

	it('an empty body stays empty', async () => {
		for (const [, metatype] of BODIES) {
			expect({ ...(await received(metatype, {})) }).toEqual({});
		}
	});

	it('still validates every member it accepts (the parent metadata is inherited unchanged)', async () => {
		await expect(received(UpdatePromotionDTO, { status: 'NOT_A_STATUS' })).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(received(UpdateCouponDTO, { usageLimit: 'many' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(received(UpdateCampaignBudgetDTO, { limit: 0.1 + 0.2 })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});
