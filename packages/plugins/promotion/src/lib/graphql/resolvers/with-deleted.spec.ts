import { FieldDefinitionNode, ObjectTypeDefinitionNode, ObjectTypeExtensionNode } from 'graphql';
import { schemaExtensions } from '../schema-extensions';
import { CampaignResolver } from './campaign.resolver';
import { CouponResolver } from './coupon.resolver';
import { GiftCardResolver } from './gift-card.resolver';
import { PromotionResolver } from './promotion.resolver';

/**
 * The soft-delete visibility of the promotion domain's four list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing:
 * every REST list route inherits `withDeleted` from `BaseQueryDTO`, and a GraphQL caller could not ask
 * for the retired rows at all, so the two surfaces answered different row sets for the same question.
 *
 * Two properties are pinned, and both are needed. The document has to **declare** the argument, because
 * a member the document does not carry is one no client can send. And the resolver has to **forward**
 * it, because an argument the read drops is worse than a missing argument: the client is told it can ask
 * and receives the same rows either way. The forwarding is asserted with the flag absent as well, where
 * the option must be missing altogether rather than present as `false` — `withDeleted: false` is a
 * statement the caller never made, and a read that wrote it would answer for a request nobody sent.
 */
describe('the promotion document — the list fields offer the soft-delete visibility the REST routes do', () => {
	/** The root query type's own field declarations, as the document spells them. */
	function queryField(name: string): FieldDefinitionNode {
		const query = schemaExtensions.definitions.find(
			(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
				(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
				definition.name.value === 'Query'
		);

		const field = query?.fields?.find((candidate) => candidate.name.value === name);

		if (!field) {
			throw new Error(`the promotion document declares no Query field named "${name}"`);
		}

		return field;
	}

	/** The four fields the REST surface already lets a caller ask for retired rows on. */
	const CONVERTED = ['promotions', 'campaigns', 'coupons', 'giftCards'];

	it.each(CONVERTED)('declares `withDeleted: Boolean` on %s', (name) => {
		const argument = queryField(name).arguments?.find((candidate) => candidate.name.value === 'withDeleted');

		expect(argument && `${argument.type.kind === 'NamedType' ? argument.type.name.value : ''}`).toBe('Boolean');
	});

	it('keeps every argument the four fields already carried', () => {
		// A conversion that dropped `page` would leave a connection a client could not walk, which is
		// the shape this whole family of fields was converted out of.
		for (const name of CONVERTED) {
			const declared = (queryField(name).arguments ?? []).map((argument) => argument.name.value);

			expect(declared).toEqual(expect.arrayContaining(['filter', 'page']));
		}
	});
});

/**
 * One page, as a service double answers it.
 */
const EMPTY_PAGE = { items: [], total: 0 };

/**
 * A service double that records the options it was handed.
 *
 * @param method The list method the resolver calls on it.
 * @returns The double and the options it received, in order.
 */
function recordingService(method: string): { service: Record<string, unknown>; calls: Array<Record<string, any>> } {
	const calls: Array<Record<string, any>> = [];

	return {
		calls,
		service: {
			[method]: async (options: Record<string, any>) => {
				calls.push(options);

				return EMPTY_PAGE;
			}
		}
	};
}

/** A service nothing in these cases is expected to call. */
const unusedService = (): Record<string, unknown> => ({});

describe('the promotion resolvers — the flag reaches the read rather than being dropped at the field', () => {
	it('forwards it into `promotions`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService('findPromotions');
		const resolver = new PromotionResolver(
			service as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.promotions(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.promotions();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `campaigns`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService('findCampaigns');
		const resolver = new CampaignResolver(
			service as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.campaigns(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.campaigns();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `coupons`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService('findCoupons');
		const resolver = new CouponResolver(
			service as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.coupons(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.coupons();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `giftCards`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService('findGiftCards');
		const resolver = new GiftCardResolver(
			service as never,
			unusedService() as never,
			unusedService() as never,
			unusedService() as never
		);

		await resolver.giftCards(undefined, undefined, undefined, undefined, undefined, true);
		await resolver.giftCards();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
