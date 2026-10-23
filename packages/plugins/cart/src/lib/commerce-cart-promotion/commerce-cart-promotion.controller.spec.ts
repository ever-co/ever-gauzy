// cspell:ignore TENOFF tenoff
/**
 * R3-07 on the applied-promotion resource: `POST /cart-promotions` and `PUT /cart-promotions/:id` wrote the
 * body as it came, `amount` included, and the cart re-priced from it — a discount of the caller's choosing,
 * one route away from the cart's own `POST /carts/:id/promotions`.
 *
 * Pinned: the create applies the named promotion through the cart (whose amount is the promotion engine's)
 * and never writes the body itself; the update refuses the discount and what it is attributed to, and still
 * passes any other member through.
 *
 * `@gauzy/core` and the two services are doubled at the module boundary, as the package's controller spec
 * doubles them: the routes are called directly and nothing here needs the application graph.
 */
jest.mock('../commerce-cart/commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));
jest.mock('./commerce-cart-promotion.service', () => ({
	CommerceCartPromotionService: class CommerceCartPromotionService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a database or a module graph. */
	const decorator = () => () => undefined;

	class CrudController {
		constructor(protected readonly service: any) {}
	}

	class BaseEntity {}

	return {
		CrudController,
		Permissions: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		VersionedColumn: decorator,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEntity: decorator,
		MultiORMColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		ColumnNumericTransformerPipe: class {},
		isValidDecimalString: () => true,
		normalizeDecimalString: (value: string) => value
	};
});

import { CommerceCartPromotionController } from './commerce-cart-promotion.controller';

/** The two services the controller holds, doubled, and the applied rows the cart recorded. */
function fixture(rows: any[] = []) {
	const cartService = { applyPromotion: jest.fn(async () => ({ id: 'cart-1' })) };
	const promotionService = {
		create: jest.fn(),
		update: jest.fn(async () => ({ affected: 1 })),
		findAll: jest.fn(async () => ({ items: rows, total: rows.length }))
	};
	const controller = new CommerceCartPromotionController(promotionService as never, cartService as never);

	return { controller, cartService, promotionService };
}

describe('CommerceCartPromotionController — the discount is the promotion engine’s (R3-07)', () => {
	it('applies the named promotion through the cart and never writes the body’s amount', async () => {
		const recorded = { id: 'row-1', cartId: 'cart-1', code: 'TENOFF', amount: 4 };
		const { controller, cartService, promotionService } = fixture([recorded]);
		const body = { cartId: 'cart-1', code: 'tenoff', amount: 40 } as any;

		const answer = await controller.create(body);

		expect(cartService.applyPromotion).toHaveBeenCalledWith('cart-1', body);
		expect(promotionService.create).not.toHaveBeenCalled();
		// The row the cart recorded — the engine's amount — is the answer.
		expect(answer).toBe(recorded);
	});

	it('refuses an update that states the discount or what it is attributed to', async () => {
		const { controller, promotionService } = fixture();

		for (const body of [
			{ amount: 1 },
			{ cartId: 'cart-2' },
			{ promotionId: 'p-2' },
			{ couponId: 'c-2' },
			{ code: 'X' }
		]) {
			await expect(controller.update('row-1', body as any)).rejects.toMatchObject({
				response: { code: 'CART_PROMOTION_NOT_WRITABLE', details: { fields: Object.keys(body) } }
			});
		}

		expect(promotionService.update).not.toHaveBeenCalled();
	});

	it('still passes any other member of an update through', async () => {
		const { controller, promotionService } = fixture();

		await controller.update('row-1', { isAutomatic: true } as any);

		expect(promotionService.update).toHaveBeenCalledWith('row-1', { isAutomatic: true });
	});
});
