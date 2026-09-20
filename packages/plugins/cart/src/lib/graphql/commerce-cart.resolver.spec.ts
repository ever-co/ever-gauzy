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
		Versioned: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned.decorator').Versioned,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf
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
