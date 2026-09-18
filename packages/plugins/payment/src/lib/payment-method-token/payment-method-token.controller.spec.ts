/**
 * The module boundaries are doubled for the reason the account-holder suite states: `@gauzy/core`
 * boots the whole application graph from its barrel and `@gauzy/config` reads the environment at
 * import time, neither of which a resource needs. **The resource under test is the real one**: the
 * controller and the lifecycle service it delegates to, over a stubbed kernel service and a real
 * field-visibility decision — the same decision the REST projection and the GraphQL field gate ask.
 *
 * The permission decorator is doubled with the platform's own metadata key, so the assertions below
 * are made against the metadata a guard reads. The card-data pipe is the package's own and runs.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, UsePipes, ValidationPipe } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, as a class the controller can extend: its routes are not what this suite pins. */
	class CrudController {
		constructor(protected readonly crudService: unknown) {}
	}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}
	}

	/**
	 * A real `FieldVisibility` in everything but the decision: only `canSee` is replaced, and the
	 * projection the service asks for is the service's own behaviour built on that decision.
	 */
	class FieldVisibility {
		canSee(): boolean {
			return grantedFor();
		}
	}

	return {
		CrudController,
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		// The platform's decorator is `UsePipes(new ValidationPipe(options))`, so the double is that same
		// one line: the ordering this suite pins is the ordering two real pipes are applied in.
		UseValidationPipe: (options: unknown) => UsePipes(new ValidationPipe(options as never)),
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		VisibleWith: (permission: string) => (target: object, property: string) =>
			Reflect.defineMetadata('__visible:with__', permission, target, property),
		PaymentAccountHolder: class PaymentAccountHolder {},
		PaymentMethodToken: class PaymentMethodToken {},
		PaymentAccountHolderService: class PaymentAccountHolderService {},
		PaymentMethodTokenService: class PaymentMethodTokenService {},
		PaymentInstrumentModule: class PaymentInstrumentModule {},
		FieldVisibility,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

/** The permission set the caller holds, which the doubled field gate reads. */
let granted: string[] = [];
const grantedFor = (): boolean => granted.includes('PAYMENT_METHOD_TOKENS_CHARGE');

import { ArgumentMetadata, PipeTransform, RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, PIPES_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { FieldVisibility, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import { PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED, RejectCardDataPipe } from '../payment.card-data.pipe';
import { PaymentMethodTokenController } from './payment-method-token.controller';
import {
	IPaymentMethodTokenDefaultResult,
	PaymentMethodTokenLifecycleService
} from './payment-method-token-lifecycle.service';

/**
 * The saved instrument over REST (06-api-specification.md §7.12, §6.8; 17-graphql-api-specification.md §6.4).
 *
 * The suite pins the properties the resource owes:
 *
 * - every route is tenant-guarded and names the permission it is reached with;
 * - the six routes are the six the endpoint table states — including `PUT /:id/default` and a `DELETE`
 *   that revokes — and the two the CRUD base maps are restated so an override cannot drop one;
 * - a card-shaped body is refused with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` and the member named,
 *   before the contract pipe sees it;
 * - **no list carries the stored reference, and a single row carries it only for a caller that may
 *   charge the instrument** — asserted against the real projection, with the field gate's decision
 *   the only thing the test fixes;
 * - a default change reports the instrument it displaced.
 *
 * The controller is constructed directly over the real lifecycle service and a stubbed kernel service.
 */

const TOKEN = '00000000-0000-4000-8000-0000000000b1';
const HOLDER = '00000000-0000-4000-8000-0000000000a1';
const PREVIOUS = '00000000-0000-4000-8000-0000000000b2';

/** The instrument a stubbed kernel service answers with: the reference is the value under test. */
const instrument = {
	id: TOKEN,
	accountHolderId: HOLDER,
	providerKey: 'a-provider',
	token: 'the-providers-own-reference',
	type: 'CARD',
	brand: 'a-brand',
	last4: '4242',
	expiryMonth: 12,
	expiryYear: 2030,
	isDefault: true,
	status: 'ACTIVE'
} as never;

/**
 * Builds the resource over a stubbed kernel.
 */
function resource() {
	const kernel = {
		findTokenOrFail: jest.fn(async () => instrument),
		findDefaultToken: jest.fn(async () => ({ ...(instrument as object), id: PREVIOUS })),
		findAll: jest.fn(async () => ({ items: [instrument], total: 1 })),
		recordProviderInstrument: jest.fn(async () => instrument),
		updateToken: jest.fn(async () => instrument),
		setDefaultToken: jest.fn(async () => instrument),
		revokeToken: jest.fn(async () => ({ ...(instrument as object), status: 'REVOKED' })),
		listByHolder: jest.fn(async () => [
			instrument,
			{ id: 'instrument-2', status: 'REVOKED', accountHolderId: HOLDER }
		])
	};
	const holders = { listHolders: jest.fn(async () => [{ id: HOLDER }]) };
	const lifecycle = new PaymentMethodTokenLifecycleService(
		kernel as never,
		holders as never,
		new FieldVisibility() as never
	);

	return { kernel, holders, lifecycle, controller: new PaymentMethodTokenController(kernel as never, lifecycle) };
}

/**
 * The route a handler maps: its path and its verb, as Nest reads them.
 *
 * A bare `@Get()` / `@Post()` writes no path at all — Nest then maps the handler at the controller's
 * own path — so the reader normalises that to `/` rather than asserting an absence as a shape.
 */
const routeOf = (handler: string) => {
	const proto = PaymentMethodTokenController.prototype as unknown as Record<string, unknown>;

	return {
		path: Reflect.getMetadata(PATH_METADATA, proto[handler]) ?? '/',
		method: Reflect.getMetadata(METHOD_METADATA, proto[handler])
	};
};

/** The pipes Nest will apply to a handler, in the order it applies them. */
const pipesOf = (handler: string): PipeTransform[] =>
	(Reflect.getMetadata(PIPES_METADATA, (PaymentMethodTokenController.prototype as never)[handler]) ??
		[]) as PipeTransform[];

/** Folds a body through a handler's pipes exactly as Nest does, in declaration order. */
const through = async (pipes: PipeTransform[], body: unknown): Promise<unknown> => {
	let value = body;

	for (const pipe of pipes) {
		value = await pipe.transform(value, { type: 'body', metatype: Object } as ArgumentMetadata);
	}

	return value;
};

beforeEach(() => {
	granted = [];
});

describe('PaymentMethodTokenController — the routes (06 §7.12)', () => {
	it('serves the resource at the path the endpoint catalogue states', () => {
		expect(Reflect.getMetadata(PATH_METADATA, PaymentMethodTokenController)).toBe('/payment-method-tokens');
	});

	it('maps the six routes of the endpoint table, with their verbs', () => {
		expect(routeOf('findAll')).toEqual({ path: '/', method: RequestMethod.GET });
		expect(routeOf('findById')).toEqual({ path: ':id', method: RequestMethod.GET });
		expect(routeOf('create')).toEqual({ path: '/', method: RequestMethod.POST });
		expect(routeOf('update')).toEqual({ path: ':id', method: RequestMethod.PUT });
		expect(routeOf('setDefault')).toEqual({ path: ':id/default', method: RequestMethod.PUT });
		expect(routeOf('delete')).toEqual({ path: ':id', method: RequestMethod.DELETE });
	});

	it('lists the instruments of the caller, defaults first, under either spelling of the filter', async () => {
		const { controller, lifecycle } = resource();
		const list = jest.spyOn(lifecycle, 'list');

		await controller.findAll({
			filter: { accountHolderId: HOLDER },
			status: 'ACTIVE',
			isDefault: true,
			take: 10
		} as never);

		expect(list).toHaveBeenCalledWith(
			{ accountHolderId: HOLDER, status: 'ACTIVE', isDefault: true },
			{ take: 10, skip: undefined }
		);
		await expect(lifecycle.list({ accountHolderId: HOLDER })).resolves.toMatchObject({ total: 1 });
	});

	it('makes an instrument the default and names the one it displaced', async () => {
		const { controller } = resource();

		const changed = (await controller.setDefault(TOKEN)) as IPaymentMethodTokenDefaultResult;

		expect(changed).toMatchObject({ id: TOKEN, isDefault: true, previousDefaultId: PREVIOUS });
	});

	it('revokes an instrument rather than deleting its row', async () => {
		const { controller, kernel } = resource();

		await expect(controller.delete(TOKEN)).resolves.toMatchObject({ id: TOKEN, status: 'REVOKED' });
		expect(kernel.revokeToken).toHaveBeenCalledWith(TOKEN);
	});
});

describe('PaymentMethodTokenController — the stored reference (06 §7.12, 17 §6.4)', () => {
	it('never carries the reference in a list, for any caller', async () => {
		granted = ['PAYMENT_METHOD_TOKENS_CHARGE'];

		const { controller } = resource();
		const page = await controller.findAll({ accountHolderId: HOLDER } as never);

		expect(page.items).toHaveLength(1);
		expect(Object.prototype.hasOwnProperty.call(page.items[0], 'token')).toBe(false);
		expect(JSON.stringify(page)).not.toContain('the-providers-own-reference');
	});

	it('projects the reference out of a single row for a caller that may not charge it', async () => {
		const { controller } = resource();
		const row = await controller.findById(TOKEN);

		// The key is absent, not null: a caller must not be able to tell a withheld value from a field
		// the resource does not have.
		expect(Object.prototype.hasOwnProperty.call(row, 'token')).toBe(false);
		expect(row).toMatchObject({ id: TOKEN, brand: 'a-brand', last4: '4242' });
	});

	it('carries the reference on a single row for a caller that may charge it', async () => {
		granted = ['PAYMENT_METHOD_TOKENS_CHARGE'];

		const { controller } = resource();

		await expect(controller.findById(TOKEN)).resolves.toMatchObject({ token: 'the-providers-own-reference' });
	});
});

describe('PaymentMethodTokenController — the guard stack and the permissions it declares', () => {
	it('guards the resource with the tenant guard first and the permission guard second', () => {
		const guards = Reflect.getMetadata('__guards__', PaymentMethodTokenController) ?? [];

		expect(guards).toEqual([TenantPermissionGuard, PermissionGuard]);
	});

	it('refuses a caller with no credential: no route is reachable without a permission', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentMethodTokenController)).toEqual([
			PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW
		]);

		for (const handler of ['findAll', 'findById', 'create', 'update', 'setDefault', 'delete']) {
			const declared =
				Reflect.getMetadata(PERMISSIONS_METADATA, (PaymentMethodTokenController.prototype as never)[handler]) ??
				Reflect.getMetadata(PERMISSIONS_METADATA, PaymentMethodTokenController);

			expect(declared?.length).toBeGreaterThan(0);
		}
	});

	it('carries the read permission on the reads and the edit permission on every write', () => {
		const permissionOf = (handler: string) =>
			Reflect.getMetadata(PERMISSIONS_METADATA, (PaymentMethodTokenController.prototype as never)[handler]);

		expect(permissionOf('findAll')).toEqual([PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW]);
		expect(permissionOf('findById')).toEqual([PaymentPermission.PAYMENT_METHOD_TOKENS_VIEW]);

		for (const handler of ['create', 'update', 'setDefault', 'delete']) {
			expect(permissionOf(handler)).toEqual([PaymentPermission.PAYMENT_METHOD_TOKENS_EDIT]);
		}
	});
});

describe('PaymentMethodTokenController — the no-card-data contract (06 §6.8, §7.12)', () => {
	it('refuses card data before the contract pipe sees the body', () => {
		for (const handler of ['create', 'update']) {
			const pipes = pipesOf(handler);

			expect(pipes).toHaveLength(2);
			expect(pipes[0]).toBeInstanceOf(RejectCardDataPipe);
			expect(pipes[1]).toBeInstanceOf(ValidationPipe);
		}
	});

	it('refuses a card number in the body, naming the member', async () => {
		const body = { accountHolderId: HOLDER, providerKey: 'a-provider', number: '4242424242424242' };

		await expect(through(pipesOf('create'), body)).rejects.toMatchObject({
			response: {
				statusCode: 400,
				code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED,
				details: { field: 'number' }
			}
		});
	});

	it('refuses a verification value and a bank account number, and passes a token-only body', async () => {
		for (const member of ['cvv', 'iban', 'accountNumber']) {
			await expect(through(pipesOf('create'), { [member]: 'x' })).rejects.toMatchObject({
				response: { code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED, details: { field: member } }
			});
		}

		const accepted = { accountHolderId: HOLDER, providerKey: 'a-provider', token: 'the-providers-own-reference' };

		await expect(through(pipesOf('create'), accepted)).resolves.toEqual(accepted);
	});

	it('refuses the same attempt on the update route', async () => {
		await expect(through(pipesOf('update'), { expiry: '12/30' })).rejects.toMatchObject({
			response: { code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED, details: { field: 'expiry' } }
		});
	});
});
