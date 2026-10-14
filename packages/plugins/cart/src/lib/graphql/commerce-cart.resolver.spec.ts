/**
 * The GraphQL surface of the cart, and whether it answers the way the REST routes do.
 *
 * A retry and a stale version are properties of the *operation*, not of the transport that carried it,
 * so the two protocols must refuse the same requests with the same codes. The suite pins that by
 * reading the declarations rather than a response: the scope names and the versioned resources the
 * resolvers carry, and the members the SDL gives the inputs those resolvers read. A caller therefore
 * cannot be told that `idempotencyKey` and `version` are acceptable on one surface and not on the
 * other, which is the failure this whole convention exists to avoid.
 */
jest.mock('../commerce-cart/commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));
jest.mock('../commerce-cart-line/commerce-cart-line.service', () => ({
	CommerceCartLineService: class CommerceCartLineService {}
}));
jest.mock('../commerce-cart-shipping-method/commerce-cart-shipping-method.service', () => ({
	CommerceCartShippingMethodService: class CommerceCartShippingMethodService {}
}));
jest.mock('../commerce-cart-promotion/commerce-cart-promotion.service', () => ({
	CommerceCartPromotionService: class CommerceCartPromotionService {}
}));
jest.mock('../commerce-checkout-session/commerce-checkout-session.service', () => ({
	CommerceCheckoutSessionService: class CommerceCheckoutSessionService {}
}));

jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');

	/** A no-op decorator factory: nothing here is mapped onto a module graph. */
	const decorator = () => () => undefined;

	/**
	 * The concurrency metadata key, taken from the kernel's own constant rather than restated as a
	 * string literal: a spec that spelled it out would keep passing after the decorator and the guard
	 * stopped agreeing on the key they use.
	 */
	const { VERSIONED_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	/** Every base class the DTOs and entities extend, declared but never mapped onto anything. */
	class BaseEntity {}

	return {
		VERSIONED_METADATA_KEY,
		Permissions: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// The feature gate the resolvers append to their guard chain, which was missing from this double:
		// `@UseGuards` is real here (it is Nest's, not one of the no-ops above), and it refuses an
		// argument that is not a guard — so every member of the chain has to be a class, not just the one
		// the suite has an opinion about.
		FeatureFlagGuard: class {},
		UseGuards: decorator,
		MultiORMEntity: decorator,
		MultiORMColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnIndex: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		// The convention as a declaration read needs it: the metadata the real decorator records, on the
		// same key. The decorator itself is not required, because it also applies the version guard —
		// which injects the idempotency service, which extends the CRUD service, which imports the
		// entity registry, so requiring it here loads `@gauzy/core` in an order where
		// `class TenantAwareCrudService extends CrudService` runs before `CrudService` is defined. No
		// guard runs in this suite; what it asserts is the metadata below.
		Versioned: (options: unknown = {}) => SetMetadata(VERSIONED_METADATA_KEY, options),
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		// The connection helpers the list fields page and answer with, taken from the kernel rather than
		// restated: a double that stubbed them would let a page drift from the contract in a suite that
		// still passed, which is the whole class of defect this conversion removed.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow
	};
});

import { print } from 'graphql';
import { IDEMPOTENT_METADATA_KEY, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartResolver } from './commerce-cart.resolver';
import { CommerceCartLineResolver } from './commerce-cart-line.resolver';
import { CommerceCartPromotionResolver } from './commerce-cart-promotion.resolver';
import { CommerceCartShippingMethodResolver } from './commerce-cart-shipping-method.resolver';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';
import { cartSchemaExtensions } from './schema-extensions';

/** What one resolver method declared about retrying it. */
const idempotencyOf = (prototype: any, method: string) =>
	Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, prototype[method]);

/** What one resolver method declared about the version it carries. */
const versioningOf = (prototype: any, method: string) => Reflect.getMetadata(VERSIONED_METADATA_KEY, prototype[method]);

/** The printed SDL, so an input's members can be read as a client reads them. */
const printed = print(cartSchemaExtensions);

/**
 * The body of one type or input declaration.
 *
 * @param kind `type` or `input`, as the declaration spells it.
 * @param name The declaration's name.
 * @returns Its members, or an empty string when the SDL does not declare it.
 */
function bodyOf(kind: string, name: string): string {
	return new RegExp(`${kind} ${name} \\{([^}]*)\\}`).exec(printed)?.[1] ?? '';
}

describe('the cart schema — the members the conventions need a client to be able to state', () => {
	it('publishes the cart version as a non-null field', () => {
		expect(bodyOf('type', 'Cart')).toMatch(/version: Int!/);
	});

	it('lets every input that updates the cart state a version', () => {
		for (const input of ['UpdateCartInput', 'AddCartLineInput', 'UpdateCartLineInput', 'SetCartShippingMethodInput', 'ApplyCartPromotionInput', 'CompleteCheckoutInput']) {
			expect(bodyOf('input', input)).toMatch(/version: Int(\s|$)/);
		}
	});

	it('lets every mutation mirroring a keyed route state a key', () => {
		expect(bodyOf('input', 'CreateCartInput')).toMatch(/idempotencyKey: String/);
		expect(bodyOf('input', 'AddCartLineInput')).toMatch(/idempotencyKey: String/);
		expect(bodyOf('input', 'SetCartShippingMethodInput')).toMatch(/idempotencyKey: String/);
		expect(bodyOf('input', 'ApplyCartPromotionInput')).toMatch(/idempotencyKey: String/);
		expect(bodyOf('input', 'StartCheckoutInput')).toMatch(/idempotencyKey: String/);
		expect(bodyOf('input', 'CompleteCheckoutInput')).toMatch(/idempotencyKey: String/);
		// A mutation whose arguments are not an input object carries the key as a sibling argument.
		expect(printed).toMatch(/mergeCarts\(targetCartId: ID!, sourceCartId: ID!, version: Int, idempotencyKey: String\)/);
	});

	it('refuses the key on a create without demanding a version of it', () => {
		// A create has no revision to have read, so the version member is an update's alone.
		expect(bodyOf('input', 'CreateCartInput')).not.toMatch(/version: Int/);
	});

	it('answers both list fields with the one connection shape, and gives each a cursor to walk from', () => {
		// The two page types were `{ items, total }` — no `pageInfo` at all — so a client of either field
		// could not tell whether there was more, let alone ask for it. `nodes`, `edges`, `totalCount` and a
		// non-null `pageInfo` is the shape every other list field of the platform answers with.
		for (const [type, edge] of [
			['CartConnection', 'CartEdge'],
			['CheckoutSessionConnection', 'CheckoutSessionEdge']
		]) {
			expect(bodyOf('type', type)).toMatch(/nodes: \[[A-Za-z]+!\]!/);
			expect(bodyOf('type', type)).toMatch(new RegExp(`edges: \\[${edge}!\\]!`));
			expect(bodyOf('type', type)).toMatch(/totalCount: Int!/);
			expect(bodyOf('type', type)).toMatch(/pageInfo: PageInfo!/);
			expect(bodyOf('type', edge)).toMatch(/node: [A-Za-z]+!/);
			expect(bodyOf('type', edge)).toMatch(/cursor: String!/);
		}
	});
});

describe('the cart resolvers — the same declarations the REST routes carry', () => {
	it('requires a retry key on the checkout and honours one on the writes that take it', () => {
		expect(idempotencyOf(CommerceCheckoutSessionResolver.prototype, 'completeCheckout')).toMatchObject({
			scope: 'checkout.complete',
			required: true,
			resourceType: 'order'
		});
		expect(idempotencyOf(CommerceCartResolver.prototype, 'createCart')).toMatchObject({
			scope: 'cart.create',
			required: false
		});
		expect(idempotencyOf(CommerceCartResolver.prototype, 'mergeCarts')).toMatchObject({ scope: 'cart.merge' });
		expect(idempotencyOf(CommerceCartLineResolver.prototype, 'addCartLine')).toMatchObject({
			scope: 'cart.line.create'
		});
		expect(idempotencyOf(CommerceCartShippingMethodResolver.prototype, 'setCartShippingMethod')).toMatchObject({
			scope: 'cart.shipping.set'
		});
		expect(idempotencyOf(CommerceCartPromotionResolver.prototype, 'applyCartPromotion')).toMatchObject({
			scope: 'cart.promotion.apply'
		});
		expect(idempotencyOf(CommerceCheckoutSessionResolver.prototype, 'startCheckout')).toMatchObject({
			scope: 'checkout.session.create'
		});
	});

	it('versions every mutation that writes the cart, against the cart', () => {
		for (const method of ['updateCart', 'deleteCart', 'associateCartWithContact', 'mergeCarts']) {
			expect(versioningOf(CommerceCartResolver.prototype, method)?.resource).toBe(CommerceCartService);
		}
		for (const method of ['addCartLine', 'updateCartLine', 'removeCartLine']) {
			expect(versioningOf(CommerceCartLineResolver.prototype, method)?.resource).toBe(CommerceCartService);
		}
		for (const method of ['setCartShippingMethod', 'removeCartShippingMethod']) {
			expect(versioningOf(CommerceCartShippingMethodResolver.prototype, method)?.resource).toBe(CommerceCartService);
		}
		for (const method of ['applyCartPromotion', 'removeCartPromotion']) {
			expect(versioningOf(CommerceCartPromotionResolver.prototype, method)?.resource).toBe(CommerceCartService);
		}
		for (const method of ['completeCheckout', 'abandonCheckout']) {
			expect(versioningOf(CommerceCheckoutSessionResolver.prototype, method)?.resource).toBe(CommerceCartService);
		}
	});

	it('states that a query does not write, because a GraphQL operation is always a POST', () => {
		expect(versioningOf(CommerceCartResolver.prototype, 'carts')).toMatchObject({ write: false });
		expect(versioningOf(CommerceCartResolver.prototype, 'cart')).toMatchObject({ write: false });
		expect(versioningOf(CommerceCheckoutSessionResolver.prototype, 'checkoutSessions')).toMatchObject({
			write: false
		});
		expect(versioningOf(CommerceCheckoutSessionResolver.prototype, 'checkoutSession')).toMatchObject({
			write: false
		});
	});

	it('names the cart a mutation writes, where it is not the `id` argument the guard reads by default', () => {
		// The guard resolves the record from `args.id` or `args.input.id`; these mutations name the cart
		// in a member of their own, so each states how to find it rather than being compared against the
		// wrong row — or against none at all.
		expect(typeof versioningOf(CommerceCartResolver.prototype, 'mergeCarts').identify).toBe('function');
		expect(typeof versioningOf(CommerceCartLineResolver.prototype, 'addCartLine').identify).toBe('function');
		expect(typeof versioningOf(CommerceCartShippingMethodResolver.prototype, 'setCartShippingMethod').identify).toBe(
			'function'
		);
		expect(typeof versioningOf(CommerceCheckoutSessionResolver.prototype, 'completeCheckout').identify).toBe(
			'function'
		);
		expect(versioningOf(CommerceCartResolver.prototype, 'updateCart').identify).toBeUndefined();
	});
});

/**
 * The soft-delete visibility of the cart's two list fields (17 §3.1).
 *
 * A connection query has to offer the same filters, the same sort keys, the same relation loading and
 * the same soft-delete visibility as the REST list route it mirrors. The last of the four was missing,
 * so a client that can ask REST for the retired rows could not ask GraphQL for them at all.
 *
 * Both halves are pinned, because either alone is useless: the document has to declare the argument,
 * since a member the document does not carry is one no client can send, and the field has to forward
 * it, since an argument the read drops is worse than a missing one — the client is told it can ask and
 * receives the same rows either way. The flag absent is asserted as well, where the option must be
 * missing altogether rather than present as `false`: a read that wrote `withDeleted: false` would
 * answer for a request nobody sent.
 */
describe('the cart list fields — the soft-delete visibility the REST routes already have', () => {
	/** One page, as a service double answers it. */
	const EMPTY_PAGE = { items: [], total: 0 };

	/**
	 * A service double that records the options it was handed.
	 *
	 * @returns The double and the options it received, in order.
	 */
	function recordingService() {
		const calls: Array<Record<string, any>> = [];

		return {
			calls,
			service: {
				findAll: async (options: Record<string, any>) => {
					calls.push(options);

					return EMPTY_PAGE;
				}
			}
		};
	}

	it('declares the argument on both fields, keeping every argument they already carried', () => {
		expect(printed).toMatch(
			/carts\(status: String, customerId: ID, email: String, page: PageInput, withDeleted: Boolean\): CartConnection!/
		);
		expect(printed).toMatch(
			/checkoutSessions\(cartId: ID, status: String, page: PageInput, withDeleted: Boolean\): CheckoutSessionConnection!/
		);
	});

	it('forwards it into `carts`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new CommerceCartResolver(service as never);

		await resolver.carts(undefined, undefined, undefined, undefined, true);
		await resolver.carts();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});

	it('forwards it into `checkoutSessions`, and writes nothing when the caller states none', async () => {
		const { service, calls } = recordingService();
		const resolver = new CommerceCheckoutSessionResolver({} as never, service as never);

		await resolver.checkoutSessions(undefined, undefined, undefined, true);
		await resolver.checkoutSessions();

		expect(calls[0]).toMatchObject({ withDeleted: true });
		expect(calls[1]).not.toHaveProperty('withDeleted');
	});
});
