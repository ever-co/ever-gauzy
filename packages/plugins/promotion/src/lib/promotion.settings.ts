import { PluginSettingContribution } from '@gauzy/plugin';

/**
 * The settings the promotion domain reads.
 *
 * A declaration is metadata only: resolution always goes through the platform settings store, so an
 * operator overrides any of these per tenant, per organization or per channel without a code change.
 * Every default is the one the domain specification states.
 */
export const PROMOTION_SETTINGS: PluginSettingContribution[] = [
	{
		key: 'promotion.reservationTtlMinutes',
		type: 'number',
		default: 30,
		scope: 'ORGANIZATION',
		description:
			'How long a reservation holds budget and usage before it is released, measured from the last cart write.'
	},
	{
		key: 'promotion.maxCandidates',
		type: 'number',
		default: 100,
		scope: 'ORGANIZATION',
		description: 'Cap on the candidate set of one evaluation, so a combinatorial explosion is bounded.'
	},
	{
		key: 'promotion.maxDiscountPercent',
		type: 'number',
		default: null,
		scope: 'ORGANIZATION',
		description: 'Guard rail: no evaluation may discount more than this share of the discountable amount.'
	},
	{
		key: 'promotion.revertOnReturn',
		type: 'string',
		default: 'PROPORTIONAL',
		scope: 'ORGANIZATION',
		description: 'What happens to a redemption when a return is received: NEVER, ALWAYS or PROPORTIONAL.'
	},
	{
		key: 'promotion.stackingEnabled',
		type: 'boolean',
		default: true,
		scope: 'ORGANIZATION',
		description: 'Whether more than one promotion may apply to the same cart.'
	},
	{
		key: 'giftCard.requirePin',
		type: 'boolean',
		default: false,
		scope: 'ORGANIZATION',
		description: 'Whether a gift card must be issued with a second factor and presented with it.'
	},
	{
		key: 'giftCard.expiryPolicy',
		type: 'string',
		default: 'BLOCK',
		scope: 'ORGANIZATION',
		description:
			'BLOCK keeps an expired balance on the card as an audit artefact; FORFEIT writes an EXPIRE movement of the remaining balance.'
	},
	{
		key: 'giftCard.codeLength',
		type: 'number',
		default: 16,
		scope: 'ORGANIZATION',
		description: 'Significant characters per generated gift-card code, in groups of four.'
	},
	{
		key: 'coupon.codeAlphabet',
		type: 'string',
		default: '23456789ABCDEFGHJKMNPQRSTVWXYZ',
		secret: false,
		scope: 'TENANT',
		description: 'Alphabet coupon and gift-card codes are drawn from.'
	}
];
