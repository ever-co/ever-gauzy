import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values the promotion domain declares.
 *
 * The values follow the platform convention — `<RESOURCE>_<ACTION>`, the resource plural and the
 * action the capability rather than the HTTP verb — and they are contributed rather than added to
 * the shared enumeration, so the package can be installed or left out without an edit to the
 * platform's own contract. A role is granted one of them exactly like a built-in permission.
 *
 * Reading a promotion, its usage and its simulation is `PROMOTIONS_VIEW`; campaigns are the grouping
 * a promotion belongs to and are edited by the same role through the same resource family, which is
 * why there is no separate campaign permission set.
 */
export const PromotionPermission = {
	PROMOTIONS_VIEW: 'PROMOTIONS_VIEW',
	PROMOTIONS_CREATE: 'PROMOTIONS_CREATE',
	PROMOTIONS_EDIT: 'PROMOTIONS_EDIT',
	PROMOTIONS_DELETE: 'PROMOTIONS_DELETE',
	PROMOTIONS_SIMULATE: 'PROMOTIONS_SIMULATE',
	COUPONS_VIEW: 'COUPONS_VIEW',
	COUPONS_CREATE: 'COUPONS_CREATE',
	COUPONS_EDIT: 'COUPONS_EDIT',
	COUPONS_DELETE: 'COUPONS_DELETE',
	GIFT_CARDS_VIEW: 'GIFT_CARDS_VIEW',
	GIFT_CARDS_ISSUE: 'GIFT_CARDS_ISSUE',
	GIFT_CARDS_EDIT: 'GIFT_CARDS_EDIT'
} as const;

/**
 * The permission catalogue this plugin contributes.
 */
export const PROMOTION_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: PromotionPermission.PROMOTIONS_VIEW,
		label: 'View promotions',
		group: 'GENERAL',
		description:
			'Read promotions, their usage ledger and their simulation output, and read the campaigns and budgets they belong to.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.PROMOTIONS_CREATE,
		label: 'Create promotions',
		group: 'GENERAL',
		description: 'Create a promotion or a campaign.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.PROMOTIONS_EDIT,
		label: 'Edit promotions',
		group: 'GENERAL',
		description:
			'Update, activate and deactivate a promotion, replace its action set, and update a campaign or set, replace and reset its budget.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.PROMOTIONS_DELETE,
		label: 'Delete promotions',
		group: 'GENERAL',
		description: 'Delete a promotion or a campaign.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.PROMOTIONS_SIMULATE,
		label: 'Simulate promotions',
		group: 'GENERAL',
		description: 'Dry-run the discount computation for a cart without applying anything.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.COUPONS_VIEW,
		label: 'View coupons',
		group: 'GENERAL',
		description: 'Read coupons and validate a code without applying it.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.COUPONS_CREATE,
		label: 'Create coupons',
		group: 'GENERAL',
		description: 'Create a coupon or a batch of codes.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.COUPONS_EDIT,
		label: 'Edit coupons',
		group: 'GENERAL',
		description: 'Update a coupon and its window and limits, and delete one.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.COUPONS_DELETE,
		label: 'Delete coupons',
		group: 'GENERAL',
		description: 'Delete a coupon or a batch of codes.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.GIFT_CARDS_VIEW,
		label: 'View gift cards',
		group: 'GENERAL',
		description: 'Read gift cards, their balances and their transaction ledgers.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.GIFT_CARDS_ISSUE,
		label: 'Issue gift cards',
		group: 'GENERAL',
		description: 'Issue a gift card. The balance is a liability, so issuing is a separate grant from editing.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: PromotionPermission.GIFT_CARDS_EDIT,
		label: 'Edit gift cards',
		group: 'GENERAL',
		description: 'Redeem, refund, adjust and cancel a gift card.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];

/**
 * The permission values as the platform guard expects them.
 *
 * `PermissionsEnum` is a closed enumeration, so a plugin cannot add a member to it; the declared
 * values above are unioned into the catalogue at bootstrap, and this helper narrows one of them for
 * `@Permissions(...)`, which is typed against the enumeration.
 *
 * @param permission One of the values this plugin declares.
 * @returns The same value, typed for the guard.
 */
export function asPermission(permission: (typeof PromotionPermission)[keyof typeof PromotionPermission]): PermissionsEnum {
	return permission as PermissionsEnum;
}
