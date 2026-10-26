import { PluginSettingContribution } from '@gauzy/plugin';

/**
 * The settings the marketplace reads, and their defaults.
 *
 * The declarations are metadata: every value is resolved through the platform's own settings store, so
 * a tenant, an organization or a channel can override any of them without a deployment, and the
 * marketplace reads them at the scope the specification names rather than inventing a configuration
 * table of its own.
 */
export const MARKETPLACE_SETTINGS: PluginSettingContribution[] = [
	{
		key: 'marketplace.defaultCommission',
		type: 'json',
		scope: 'CHANNEL',
		description:
			'The platform default commission a seller-owned line falls back to: `{ rate, basis, tiers?, fixedFeePerItem?, currency? }`. There is no implicit zero — a seller-owned line without a resolvable commission is refused at publication.'
	},
	{
		key: 'marketplace.requiredVerifications',
		type: 'string[]',
		scope: 'CHANNEL',
		default: ['BUSINESS_IDENTITY', 'TAX_IDENTIFIER', 'PAYOUT_ACCOUNT'],
		description:
			'Which verification kinds must reach VERIFIED before a seller may be approved. The shipping default is all three, because a seller that cannot be identified and cannot receive money must not accumulate a balance.'
	},
	{
		key: 'marketplace.verificationValidityDays',
		type: 'number',
		scope: 'ORGANIZATION',
		default: 365,
		description: 'How long a recorded verification stays valid before it expires and holds payouts.'
	},
	{
		key: 'marketplace.sellerSelfPublish',
		type: 'boolean',
		scope: 'CHANNEL',
		default: false,
		description: 'Whether a seller may publish its own offerings, or only submit them for moderation.'
	},
	{
		key: 'marketplace.sellerFulfilsShipping',
		type: 'boolean',
		scope: 'CHANNEL',
		default: false,
		description:
			'Whether shipping is charged per seller rather than once per order, which decides whether a shipping charge is attributed to a seller at all.'
	},
	{
		key: 'marketplace.dropshipShippingOwner',
		type: 'string',
		scope: 'CHANNEL',
		default: 'SELLER',
		description: 'Who bears shipping for a dropshipped line: the seller, or the platform.'
	},
	{
		key: 'marketplace.commissionOn',
		type: 'string',
		scope: 'CHANNEL',
		default: 'LINE',
		description:
			'Whether the commission is computed on each line or on the order as a whole and then distributed across the sellers’ lines by largest remainder.'
	},
	{
		key: 'marketplace.commissionBasisOnPlatformDiscount',
		type: 'string',
		scope: 'CHANNEL',
		default: 'EXCLUDE',
		description:
			'Whether a platform-funded discount reduces the commission basis. The default is that it does not: the platform chose to fund the discount and does not thereby reduce its own fee.'
	},
	{
		key: 'marketplace.maxSellerFundedDiscountPercent',
		type: 'number',
		scope: 'CHANNEL',
		description: 'The largest discount a seller may fund on a line, as a fraction, where a tenant wants a ceiling.'
	},
	{
		key: 'marketplace.negativeBalanceAlertThreshold',
		type: 'number',
		scope: 'ORGANIZATION',
		description:
			'The size of a negative carry-forward above which a finance alert is raised. Recovery is a decision, never an automatic debit.'
	},
	{
		key: 'marketplace.reserveReportDays',
		type: 'number',
		scope: 'ORGANIZATION',
		default: 90,
		description: 'How long a reserve may be held before it is reported as long-held.'
	},
	{
		key: 'marketplace.autoReleaseReserve',
		type: 'boolean',
		scope: 'ORGANIZATION',
		default: false,
		description: 'Whether the reserve report may lower a seller’s reserve percentage itself, or only report it.'
	},
	{
		key: 'marketplace.offboardingSlaDays',
		type: 'number',
		scope: 'ORGANIZATION',
		description: 'How long a seller may stay in OFFBOARDING before it is reported as overdue.'
	}
];
