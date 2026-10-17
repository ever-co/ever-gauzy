/**
 * The REST doors of the cart that were looser than their GraphQL twins (R2-G17, R2-G18, R2-G25).
 *
 * - `POST /carts/:id/abandon` asked `CARTS_EDIT` where `abandonCheckout` asks `CARTS_CHECKOUT` for the
 *   same `CommerceCartService.abandon` — both now state the checkout grant.
 * - `DELETE /carts/:id` demanded no version where `deleteCart` demands one — both are versioned now.
 * - `PUT /carts/:id` wrote any `status` its body carried (a COMPLETED cart could be put back to ACTIVE);
 *   the `updateCart` input carries none. A differing status is now refused before anything is written.
 * - `POST /cart-lines` and `POST /cart-shipping-methods` wrote their row through the child's own
 *   `CrudService.create`, skipping the cart's mutability, stock, reference and version checks and its
 *   re-pricing. They now go through `addLine` / `setShippingMethod`, the call `addCartLine` /
 *   `setCartShippingMethod` make, under the cart's version.
 *
 * The controllers and resolvers are the real ones; the services are stubs, and `@gauzy/core`'s barrel is
 * doubled for the reason the package's other suites give (it boots the application graph). `@Permissions`
 * is the kernel's own, so the grants compared are the metadata the guard reads.
 */
jest.mock('./commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));
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
	/** A no-op decorator factory: nothing here is mapped onto a database. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService: class {},
		TenantAwareCrudService: class {},
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}
		},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util')
			.VERSIONED_METADATA_KEY,
		// The real decorator mounts the guard and interceptor, which reach the entity graph; what is read
		// here is the metadata it writes, on the kernel's own key.
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		formatEntityTag: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').formatEntityTag,
		parseEntityVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').parseEntityVersion,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		GraphqlConnection: class {},
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		normalizeDecimalString: (value: unknown) => String(value),
		isValidDecimalString: () => true
	};
});

import { CommerceCartStatus } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { VERSIONED_METADATA_KEY } from '@gauzy/core';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CommerceCartController } from './commerce-cart.controller';
import { CommerceCartService } from './commerce-cart.service';
import { CommerceCartLineController } from '../commerce-cart-line/commerce-cart-line.controller';
import { CommerceCartShippingMethodController } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.controller';
import { CommerceCheckoutSessionResolver } from '../graphql/commerce-checkout-session.resolver';
import { CommerceCartResolver } from '../graphql/commerce-cart.resolver';

const CART_ID = '00000000-0000-4000-8000-0000000000c1';

/** What the version guard leaves on the request; both surfaces' writes consume it. */
const EXPECTATION = { wildcard: false, versions: [7] };
const REQUEST = { versionExpectation: EXPECTATION } as any;

/** The permission one handler runs under: its own metadata, else its class's (the guard's rule). */
function grantOf(type: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (type.prototype as any)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, type)
	);
}

function versioningOf(type: new (...args: any[]) => any, handler: string): any {
	return Reflect.getMetadata(VERSIONED_METADATA_KEY, (type.prototype as any)[handler]);
}

describe('R2-G17 — abandoning a cart asks the same grant over REST and GraphQL', () => {
	it('states CARTS_CHECKOUT on POST /carts/:id/abandon, the grant abandonCheckout states', () => {
		expect(grantOf(CommerceCheckoutSessionResolver, 'abandonCheckout')).toEqual([CART_PERMISSIONS.CARTS_CHECKOUT]);
		expect(grantOf(CommerceCartController, 'abandon')).toEqual(
			grantOf(CommerceCheckoutSessionResolver, 'abandonCheckout')
		);
	});

	it('reaches the same service call with the same version expectation', async () => {
		const cartService = { abandon: jest.fn().mockResolvedValue({ id: CART_ID }) };
		const controller = new CommerceCartController(cartService as any);
		const resolver = new CommerceCheckoutSessionResolver(cartService as any, {} as any);

		await controller.abandon(CART_ID, REQUEST);
		await resolver.abandonCheckout(CART_ID, { req: REQUEST });

		expect(cartService.abandon).toHaveBeenNthCalledWith(1, CART_ID, EXPECTATION);
		expect(cartService.abandon).toHaveBeenNthCalledWith(2, CART_ID, EXPECTATION);
	});
});

describe('R2-G18 — deleting a cart is versioned on both protocols', () => {
	it('states on DELETE /carts/:id the version requirement deleteCart states', () => {
		const route = versioningOf(CommerceCartController, 'delete');
		const field = versioningOf(CommerceCartResolver, 'deleteCart');

		expect(field?.resource).toBe(CommerceCartService);
		expect(route?.resource).toBe(field.resource);
		// Required on both: neither states `required: false`, so a delete that names no version is a 428.
		expect(route?.required ?? true).toBe(true);
		expect(field?.required ?? true).toBe(true);
		expect(grantOf(CommerceCartController, 'delete')).toEqual(grantOf(CommerceCartResolver, 'deleteCart'));
	});
});

describe('R2-G25 — PUT /carts/:id does not move the status', () => {
	function fixture(status: CommerceCartStatus) {
		const cartService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: CART_ID, status }),
			applyChanges: jest.fn().mockResolvedValue({ id: CART_ID, status })
		};

		return { cartService, controller: new CommerceCartController(cartService as any) };
	}

	it('refuses to reopen a COMPLETED cart, and writes nothing', async () => {
		const { cartService, controller } = fixture(CommerceCartStatus.COMPLETED);

		await expect(
			controller.update(CART_ID, { status: CommerceCartStatus.ACTIVE, note: 'reopen' } as any, REQUEST)
		).rejects.toMatchObject({
			response: {
				code: 'CART_STATUS_NOT_WRITABLE',
				details: { status: CommerceCartStatus.COMPLETED, requested: CommerceCartStatus.ACTIVE }
			}
		});
		expect(cartService.applyChanges).not.toHaveBeenCalled();
	});

	it.each([CommerceCartStatus.ABANDONED, CommerceCartStatus.MERGED, CommerceCartStatus.EXPIRED])(
		'refuses any other status than the %s cart already has',
		async (current) => {
			const { cartService, controller } = fixture(current);

			await expect(
				controller.update(CART_ID, { status: CommerceCartStatus.ACTIVE } as any, REQUEST)
			).rejects.toMatchObject({ response: { code: 'CART_STATUS_NOT_WRITABLE' } });
			expect(cartService.applyChanges).not.toHaveBeenCalled();
		}
	);

	it('accepts a body that restates the current status, and drops the member', async () => {
		const { cartService, controller } = fixture(CommerceCartStatus.ACTIVE);

		await controller.update(CART_ID, { status: CommerceCartStatus.ACTIVE, note: 'gift' } as any, REQUEST);

		expect(cartService.applyChanges).toHaveBeenCalledWith(CART_ID, { note: 'gift' }, EXPECTATION);
	});

	it('does not read the cart for an update that states no status', async () => {
		const { cartService, controller } = fixture(CommerceCartStatus.ACTIVE);

		await controller.update(CART_ID, { email: 'buyer@example.com' } as any, REQUEST);

		expect(cartService.findOneByIdString).not.toHaveBeenCalled();
		expect(cartService.applyChanges).toHaveBeenCalledWith(CART_ID, { email: 'buyer@example.com' }, EXPECTATION);
	});
});

/** A request whose response records the headers set on it. */
function requestWithResponse() {
	const headers: Record<string, string> = {};
	const res = { headersSent: false, setHeader: jest.fn((name: string, value: string) => (headers[name] = value)) };

	return { request: { ...REQUEST, res } as any, headers };
}

/** A child service whose `findAll` answers the rows before the write, then the rows after it. */
function childService(before: any[], after: any[]) {
	return {
		create: jest.fn(),
		findAll: jest
			.fn()
			.mockResolvedValueOnce({ items: before, total: before.length })
			.mockResolvedValueOnce({ items: after, total: after.length })
	};
}

describe('R2-G25 — POST /cart-lines adds the line through the cart', () => {
	const body = {
		cartId: CART_ID,
		variantId: 'variant-1',
		quantity: 2,
		unitPrice: '5.000000'
	} as any;
	const other = { id: 'line-0', cartId: CART_ID, variantId: 'variant-0', quantity: 1, createdAt: new Date(1) };

	function fixture(before: any[], after: any[]) {
		const lineService = childService(before, after);
		const cartService = { addLine: jest.fn().mockResolvedValue({ id: CART_ID, version: 9 }) };
		const controller = new CommerceCartLineController(lineService as any, cartService as any);

		return { lineService, cartService, controller };
	}

	it('reaches addLine — the call addCartLine makes — and never the bare create', async () => {
		const created = { id: 'line-1', cartId: CART_ID, variantId: 'variant-1', quantity: 2, createdAt: new Date(5) };
		const { lineService, cartService, controller } = fixture([other], [other, created]);
		const { request, headers } = requestWithResponse();

		const answer = await controller.create(body, request);

		expect(cartService.addLine).toHaveBeenCalledWith(CART_ID, body, EXPECTATION);
		expect(lineService.create).not.toHaveBeenCalled();
		// The answer is still the line the addition produced, not the cart …
		expect(answer).toBe(created);
		// … and the ETag is the cart's new version, the one the next write to the cart states.
		expect(headers['ETag']).toBe('"9"');
	});

	it('answers the line the addition merged into when the purchase was already in the cart', async () => {
		const held = { id: 'line-1', cartId: CART_ID, variantId: 'variant-1', quantity: 1, updatedAt: new Date(1) };
		const grown = { ...held, quantity: 3, updatedAt: new Date(6) };
		const { controller } = fixture([other, held], [other, grown]);

		expect(await controller.create(body, requestWithResponse().request)).toBe(grown);
	});

	it('answers its own row, not one a concurrent request added, even once that request retired it', async () => {
		const mine = {
			id: 'line-2',
			cartId: CART_ID,
			variantId: 'variant-1',
			quantity: 2,
			createdAt: new Date(5),
			deletedAt: new Date(7)
		};
		const theirs = { id: 'line-3', cartId: CART_ID, variantId: 'variant-9', quantity: 1, createdAt: new Date(6) };
		const { lineService, controller } = fixture([other], [other, mine, theirs]);

		expect(await controller.create(body, requestWithResponse().request)).toBe(mine);
		// The second read includes retired rows.
		expect(lineService.findAll).toHaveBeenLastCalledWith({ where: { cartId: CART_ID }, withDeleted: true });
	});

	it('propagates the cart refusing the addition (an immutable cart, short stock), writing nothing', async () => {
		const { lineService, cartService, controller } = fixture([], []);
		cartService.addLine.mockRejectedValueOnce(new Error('CART_STATUS_INVALID: a COMPLETED cart is immutable.'));

		await expect(controller.create(body, REQUEST)).rejects.toThrow(/CART_STATUS_INVALID/);
		expect(lineService.create).not.toHaveBeenCalled();
	});

	it('is versioned against the cart its body names', () => {
		const options = versioningOf(CommerceCartLineController, 'create');

		expect(options?.resource).toBe(CommerceCartService);
		expect(options?.required).not.toBe(false);
		expect(options.identify({ body: { cartId: CART_ID } })).toBe(CART_ID);
		expect(options.identify({ body: {} })).toBeUndefined();
		expect(grantOf(CommerceCartLineController, 'create')).toEqual([CART_PERMISSIONS.CARTS_EDIT]);
	});
});

describe('R2-G25 — POST /cart-shipping-methods sets the choice through the cart', () => {
	const body = { cartId: CART_ID, name: 'Courier', amount: '4.000000' } as any;
	const previous = { id: 'ship-1', cartId: CART_ID, name: 'Post', createdAt: new Date(1) };

	function fixture(before: any[], after: any[]) {
		const shippingService = childService(before, after);
		const cartService = { setShippingMethod: jest.fn().mockResolvedValue({ id: CART_ID, version: 4 }) };
		const controller = new CommerceCartShippingMethodController(shippingService as any, cartService as any);

		return { shippingService, cartService, controller };
	}

	it('reaches setShippingMethod — the call setCartShippingMethod makes — and never the bare create', async () => {
		const mine = { id: 'ship-2', cartId: CART_ID, name: 'Courier', createdAt: new Date(5) };
		const { shippingService, cartService, controller } = fixture(
			[previous],
			[{ ...previous, deletedAt: new Date(5) }, mine]
		);
		const { request, headers } = requestWithResponse();

		const answer = await controller.create(body, request);

		expect(cartService.setShippingMethod).toHaveBeenCalledWith(CART_ID, body, EXPECTATION);
		expect(shippingService.create).not.toHaveBeenCalled();
		expect(answer).toBe(mine);
		expect(headers['ETag']).toBe('"4"');
	});

	it('answers its own choice when a concurrent choice landed after it and retired it', async () => {
		const mine = { id: 'ship-2', cartId: CART_ID, name: 'Courier', createdAt: new Date(5), deletedAt: new Date(6) };
		const theirs = { id: 'ship-3', cartId: CART_ID, name: 'Express', createdAt: new Date(6) };
		const { controller } = fixture([previous], [{ ...previous, deletedAt: new Date(5) }, mine, theirs]);

		expect(await controller.create(body, requestWithResponse().request)).toBe(mine);
	});

	it('is versioned against the cart its body names', () => {
		const options = versioningOf(CommerceCartShippingMethodController, 'create');

		expect(options?.resource).toBe(CommerceCartService);
		expect(options.identify({ body: { cartId: CART_ID } })).toBe(CART_ID);
	});
});
