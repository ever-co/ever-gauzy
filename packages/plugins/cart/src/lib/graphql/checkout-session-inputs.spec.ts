/**
 * The checkout-session inputs a column cannot hold are refused with 400 (R2-G24).
 *
 * `UpdateCheckoutSessionInput.status`, `StartCheckoutInput.step` and the `step` argument of
 * `completeStepCommerceCheckoutSession` are declared `String`, so GraphQL validation let any text through to
 * columns of 16 and 64 characters: a status outside the enumeration was stored (or, past 16 characters, a
 * database error), and a step past 64 characters was a database error. The REST body validates both
 * (`@IsEnum(CommerceCheckoutSessionStatus)`, `@MaxLength(64)`); the fields now do the same.
 *
 * The module doubles are `write-routes.spec.ts`'s, for the reasons it gives.
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
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
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
		// The three inherited lifecycle routes, in the shape the kernel declares them: `delete` hands the
		// service the bare identifier, and the two soft routes hand it their rest parameter, which is an
		// empty ARRAY when the route was called with only an id.
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}

			async delete(id: any): Promise<any> {
				return this.service.delete(id);
			}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.service.softRecover(id, options);
			}
		},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		// The export mark the cart's token digest carries; nothing is exported here.
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		// The permission and retry decorators are the kernel's own: what this suite compares between a
		// route and the field that mirrors it is the metadata they write.
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		// Every resolver class carries the platform's feature guard, so the double provides the class
		// the resolver imports: an undefined guard handed to the real `@UseGuards` fails the suite.
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		// Rebuilt rather than required: the real decorator imports the version guard, the interceptor behind
		// it and the idempotency service behind that, which reaches the entity graph. What the declarations
		// under test read is the metadata it writes, so that is what the double writes — on the kernel's own
		// key, taken from the kernel rather than restated as a string literal.
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util')
			.VERSIONED_METADATA_KEY,
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
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
		// The validation pipe the controllers build at class-definition time; Nest refuses a pipe with no
		// `transform`, and the controller files reach it through this barrel.
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		// The two decimal helpers the money DTOs reach: they are called inside a validator's `validate`,
		// which nothing in this suite runs, so the double states the shape rather than the arithmetic.
		normalizeDecimalString: (value: unknown) => String(value),
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		isValidDecimalString: () => true
	};
});

import { CommerceCheckoutSessionStatus } from '@gauzy/contracts';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';
import { CHECKOUT_STEP_MAX_LENGTH, assertCheckoutSessionMembers } from './filters';

const ID = '00000000-0000-4000-8000-0000000000f1';

function fixture() {
	const session = {
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue({ id: ID }),
		findOpenForCart: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockResolvedValue({ id: ID }),
		completeStep: jest.fn().mockResolvedValue({ id: ID })
	};
	const resolver = new CommerceCheckoutSessionResolver({} as any, session as any);

	return { session, resolver };
}

describe('R2-G24 — checkout-session members the columns cannot hold', () => {
	it('refuses updateCommerceCheckoutSession with an unknown status, and writes nothing', async () => {
		const { session, resolver } = fixture();

		await expect(
			resolver.updateCommerceCheckoutSession(ID, { status: 'PAID_IN_FULL_HONEST' })
		).rejects.toMatchObject({
			status: 400,
			code: 'VALIDATION_INVALID_ENUM',
			details: { field: 'status', reason: 'CHECKOUT_SESSION_STATUS_INVALID' }
		});
		expect(session.update).not.toHaveBeenCalled();
	});

	it('refuses a step longer than the column on all three writes, and writes nothing', async () => {
		const { session, resolver } = fixture();
		const long = 'S'.repeat(CHECKOUT_STEP_MAX_LENGTH + 1);

		for (const write of [
			() => resolver.updateCommerceCheckoutSession(ID, { step: long }),
			() => resolver.startCheckout({ cartId: ID, step: long }),
			() => resolver.completeStepCommerceCheckoutSession(ID, long)
		]) {
			await expect(write()).rejects.toMatchObject({
				status: 400,
				code: 'VALIDATION_FAILED',
				details: { reason: 'CHECKOUT_STEP_INVALID' }
			});
		}

		expect(session.update).not.toHaveBeenCalled();
		expect(session.create).not.toHaveBeenCalled();
		expect(session.completeStep).not.toHaveBeenCalled();
	});

	it('still writes members the columns hold', async () => {
		const { session, resolver } = fixture();

		await resolver.updateCommerceCheckoutSession(ID, {
			status: CommerceCheckoutSessionStatus.IN_PROGRESS,
			step: 'PAYMENT'
		});
		await resolver.startCheckout({ cartId: ID, step: 'S'.repeat(CHECKOUT_STEP_MAX_LENGTH) });
		await resolver.completeStepCommerceCheckoutSession(ID, 'SHIPPING');

		expect(session.update).toHaveBeenCalledTimes(1);
		expect(session.create).toHaveBeenCalledTimes(1);
		expect(session.completeStep).toHaveBeenCalledWith(ID, 'SHIPPING', undefined);
	});

	it('does not check a member the input omits', () => {
		expect(() => assertCheckoutSessionMembers({})).not.toThrow();
		expect(() => assertCheckoutSessionMembers(undefined)).not.toThrow();
		expect(() => assertCheckoutSessionMembers({ status: null, step: null })).not.toThrow();
	});
});
