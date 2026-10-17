import { applyDecorators } from '@nestjs/common';
import { FEATURE_GRAPHQL } from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { MarketplaceFeatures } from '../marketplace.features';

/**
 * The codes a payout, payout-line or settlement field requires: the endpoint, the marketplace and its
 * payouts, which is what `SellerPayoutController`, `SellerPayoutLineController` and
 * `SellerSettlementController` require of their routes — and `sellerStatement`, which carries the
 * seller's payouts and settlements, as `GET /sellers/:id/statement` does. A field-level statement replaces the class's
 * codes for that field, so all three are stated here.
 *
 * It lives in a file of its own because two resolvers state it — the queries and mutations in
 * `marketplace.resolver.ts` and the payout and settlement streams in `marketplace-subscription.resolver.ts` — and one
 * definition is what keeps the two from requiring different codes for the same resource.
 */
export const MarketplacePayoutsGate = () =>
	applyDecorators(
		FeatureFlag(FEATURE_GRAPHQL),
		FeatureFlag(MarketplaceFeatures.MARKETPLACE),
		FeatureFlag(MarketplaceFeatures.PAYOUTS)
	);
