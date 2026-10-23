import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { PromotionPermission } from '../promotion.permissions';
import { PromotionStatus } from '../promotion.types';

/** What a create states that makes it more than a draft. */
export interface IPromotionPublishingInput {
	readonly actions?: ReadonlyArray<unknown> | null;
	readonly status?: PromotionStatus | string | null;
}

/**
 * Refuses a create that publishes a discount unless the caller also holds `PROMOTIONS_EDIT` (review R2-G29).
 *
 * `PROMOTIONS_CREATE` is the grant to author a draft. Giving a promotion its effect (`PUT /promotions/:id/actions`,
 * `replacePromotionActions`) and starting it (`POST /promotions/:id/activate`, `activatePromotion`) are
 * `PROMOTIONS_EDIT` on both surfaces - but `createPromotion` accepted `actions` and `status: ACTIVE` in one call under
 * `PROMOTIONS_CREATE` alone, so a caller who may only draft published a live discount. A create that states a
 * non-empty action set or the `ACTIVE` status now needs both grants (the route's own, checked by its guard, and this
 * one); a plain draft is unchanged. `POST /promotions` takes no action set, and is held to the same rule for `status`.
 *
 * @param input The create as the caller stated it.
 * @throws ForbiddenException with `PROMOTION_PUBLISH_FORBIDDEN` when the create publishes and the caller may not edit.
 */
export function assertMayPublishOnCreate(input: IPromotionPublishingInput | null | undefined): void {
	const withActions = Array.isArray(input?.actions) && input.actions.length > 0;
	const active = input?.status === PromotionStatus.ACTIVE;

	if (!withActions && !active) {
		return;
	}

	if (!RequestContext.hasPermission(PromotionPermission.PROMOTIONS_EDIT as PermissionsEnum)) {
		const what = [withActions ? 'an action set' : null, active ? 'the ACTIVE status' : null]
			.filter(Boolean)
			.join(' and ');

		throw new ForbiddenException({
			message:
				`PROMOTION_PUBLISH_FORBIDDEN: creating a promotion with ${what} publishes a discount, which needs ` +
				`PROMOTIONS_EDIT as well as PROMOTIONS_CREATE; create it as a draft and let an editor add its actions ` +
				`and activate it.`,
			code: 'PROMOTION_PUBLISH_FORBIDDEN'
		});
	}
}
