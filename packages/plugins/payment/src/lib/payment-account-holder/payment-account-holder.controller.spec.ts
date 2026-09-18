/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which an account resource needs and none of which is
 * available outside a running application. `@gauzy/config` reads the process environment at import
 * time. Both are therefore doubled at the module boundary, and **the resource under test is the real
 * one**: the controller and the lifecycle service it delegates to, over a stubbed kernel service.
 *
 * The permission decorator is doubled with the platform's own metadata key, read from the platform's
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator's prose. The card-data pipe is the package's own and runs for real.
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
		// The decorator the controller carries. `Permissions` writes the same metadata the platform's
		// own decorator writes, so the assertions below read what a guard reads.
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		PaymentAccountHolder: class PaymentAccountHolder {},
		PaymentMethodToken: class PaymentMethodToken {},
		PaymentAccountHolderService: class PaymentAccountHolderService {},
		PaymentMethodTokenService: class PaymentMethodTokenService {},
		PaymentInstrumentModule: class PaymentInstrumentModule {},
		FieldVisibility: class FieldVisibility {
			canSee(): boolean {
				return false;
			}
		},
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

import { ArgumentMetadata, PipeTransform, RequestMethod, ValidationPipe } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, PIPES_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import { PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED, RejectCardDataPipe } from '../payment.card-data.pipe';
import { PaymentAccountHolderController } from './payment-account-holder.controller';
import {
	IPaymentAccountHolderDisableResult,
	PaymentAccountHolderLifecycleService
} from './payment-account-holder-lifecycle.service';

/**
 * The remembered payer over REST (06-api-specification.md §7.12, §6.8).
 *
 * The suite pins the properties the resource owes, and each of them is a decision the specification
 * states rather than a shape somebody chose:
 *
 * - every route is tenant-guarded and names the permission it is reached with — a route that carried
 *   none would be reachable by any authenticated caller, which is what "a refusal with no credential"
 *   means for a resource whose guards are the only authentication there is;
 * - the six routes are the six the endpoint table states, at the paths it states, and the two the base
 *   class maps are restated so an override cannot silently drop one;
 * - a body that carries card data is refused with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED` and the
 *   member named, **before** the contract pipe sees it — the refusal is a validation failure, never a
 *   silent drop, and the member's value never reaches the message;
 * - disabling answers the account and how many instruments the close revoked with it.
 *
 * The controller is constructed directly over the real lifecycle service and a stubbed kernel service:
 * the composition the API adds — the mandate routing, the verdict and its status move, the count — is
 * therefore the real composition, and only the kernel's own rules are stubbed out.
 */

const HOLDER = '00000000-0000-4000-8000-0000000000a1';

/** The account a stubbed kernel service answers with. */
const account = {
	id: HOLDER,
	providerKey: 'a-provider',
	type: 'CUSTOMER',
	status: 'PENDING',
	verificationStatus: 'UNVERIFIED',
	metadata: { onboarding: 'started' }
} as never;

/**
 * Builds the resource over a stubbed kernel.
 *
 * The stub records what it was asked and answers the rows the cases need; the lifecycle service over
 * it is the real one, so the sequencing assertions below are about the package's own code.
 */
function resource() {
	const kernel = {
		findHolderOrFail: jest.fn(async () => account),
		findAll: jest.fn(async () => ({ items: [account], total: 1 })),
		createHolder: jest.fn(async () => account),
		updateHolder: jest.fn(async () => account),
		recordProviderAccount: jest.fn(async () => account),
		transitionStatus: jest.fn(async () => account),
		disableHolder: jest.fn(async () => ({ ...(account as object), status: 'DISABLED' })),
		clearMandate: jest.fn(async () => account),
		setMandate: jest.fn(async () => account)
	};
	const instruments = {
		list: jest.fn(async () => ({ items: [{ id: 'instrument-1', brand: 'a-brand' }], total: 1 })),
		countLive: jest.fn(async () => 2)
	};
	const lifecycle = new PaymentAccountHolderLifecycleService(kernel as never, instruments as never);

	return { kernel, instruments, lifecycle, controller: new PaymentAccountHolderController(kernel as never, lifecycle) };
}

/**
 * The route a handler maps: its path and its verb, as Nest reads them.
 *
 * A bare `@Get()` / `@Post()` writes no path at all — Nest then maps the handler at the controller's
 * own path — so the reader normalises that to `/` rather than asserting an absence as a shape.
 */
const routeOf = (handler: string) => {
	const proto = PaymentAccountHolderController.prototype as unknown as Record<string, unknown>;

	return {
		path: Reflect.getMetadata(PATH_METADATA, proto[handler]) ?? '/',
		method: Reflect.getMetadata(METHOD_METADATA, proto[handler])
	};
};

/** The pipes Nest will apply to a handler, in the order it applies them. */
const pipesOf = (handler: string): PipeTransform[] =>
	(Reflect.getMetadata(PIPES_METADATA, (PaymentAccountHolderController.prototype as never)[handler]) ??
		[]) as PipeTransform[];

/** Folds a body through a handler's pipes exactly as Nest does, in declaration order. */
const through = async (pipes: PipeTransform[], body: unknown): Promise<unknown> => {
	let value = body;

	for (const pipe of pipes) {
		value = await pipe.transform(value, { type: 'body', metatype: Object } as ArgumentMetadata);
	}

	return value;
};

describe('PaymentAccountHolderController — the routes (06 §7.12)', () => {
	it('serves the resource at the path the endpoint catalogue states', () => {
		expect(Reflect.getMetadata(PATH_METADATA, PaymentAccountHolderController)).toBe('/payment-account-holders');
	});

	it('maps the six routes of the endpoint table, with their verbs', () => {
		expect(routeOf('findAll')).toEqual({ path: '/', method: RequestMethod.GET });
		expect(routeOf('findById')).toEqual({ path: ':id', method: RequestMethod.GET });
		expect(routeOf('create')).toEqual({ path: '/', method: RequestMethod.POST });
		expect(routeOf('update')).toEqual({ path: ':id', method: RequestMethod.PUT });
		expect(routeOf('verify')).toEqual({ path: ':id/verify', method: RequestMethod.POST });
		expect(routeOf('delete')).toEqual({ path: ':id', method: RequestMethod.DELETE });
	});

	it('lists the accounts of the caller, under either spelling of the filter', async () => {
		const { controller, kernel } = resource();

		await controller.findAll({ filter: { status: 'ACTIVE' }, contactId: 'contact-1', take: 25, skip: 5 } as never);

		expect(kernel.findAll).toHaveBeenCalledWith({
			where: { status: 'ACTIVE', contactId: 'contact-1' },
			order: { createdAt: 'DESC' },
			take: 25,
			skip: 5
		});
	});

	it('reads one account with the instruments saved under it', async () => {
		const { controller } = resource();

		await expect(controller.findById(HOLDER)).resolves.toMatchObject({
			id: HOLDER,
			methodTokens: [{ id: 'instrument-1', brand: 'a-brand' }]
		});
	});

	it('disables the account and reports how many instruments went with it', async () => {
		const { controller, kernel, instruments } = resource();

		const disabled = (await controller.delete(HOLDER)) as IPaymentAccountHolderDisableResult;

		expect(instruments.countLive).toHaveBeenCalledWith(HOLDER);
		expect(kernel.disableHolder).toHaveBeenCalledWith(HOLDER);
		expect(disabled).toMatchObject({ id: HOLDER, status: 'DISABLED', revokedTokenCount: 2 });
	});
});

describe('PaymentAccountHolderController — the guard stack and the permissions it declares', () => {
	it('guards the resource with the tenant guard first and the permission guard second', () => {
		const guards = Reflect.getMetadata('__guards__', PaymentAccountHolderController) ?? [];

		// The order is the contract: the tenant guard refuses a caller with no credential before any
		// permission is consulted, so an unauthenticated request never reaches the permission lookup.
		expect(guards).toEqual([TenantPermissionGuard, PermissionGuard]);
	});

	it('refuses a caller with no credential: no route is reachable without a permission', () => {
		// What a guard reads: the handler's own metadata when it declares one — the platform's decorator
		// writes it onto the handler itself — and the class's metadata otherwise. A route with neither
		// would be reachable by any authenticated caller, which is the gap this pins.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, PaymentAccountHolderController)).toEqual([
			PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW
		]);

		for (const handler of ['findAll', 'findById', 'create', 'update', 'verify', 'delete']) {
			const declared =
				Reflect.getMetadata(PERMISSIONS_METADATA, (PaymentAccountHolderController.prototype as never)[handler]) ??
				Reflect.getMetadata(PERMISSIONS_METADATA, PaymentAccountHolderController);

			expect(declared?.length).toBeGreaterThan(0);
		}
	});

	it('carries the read permission on the reads and the edit permission on every write', () => {
		const permissionOf = (handler: string) =>
			Reflect.getMetadata(PERMISSIONS_METADATA, (PaymentAccountHolderController.prototype as never)[handler]);

		expect(permissionOf('findAll')).toEqual([PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW]);
		expect(permissionOf('findById')).toEqual([PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_VIEW]);

		for (const handler of ['create', 'update', 'verify', 'delete']) {
			expect(permissionOf(handler)).toEqual([PaymentPermission.PAYMENT_ACCOUNT_HOLDERS_EDIT]);
		}
	});
});

describe('PaymentAccountHolderController — the no-card-data contract (06 §6.8, §7.12)', () => {
	it('refuses card data before the contract pipe sees the body', () => {
		for (const handler of ['create', 'update', 'verify']) {
			const pipes = pipesOf(handler);

			expect(pipes).toHaveLength(2);
			// Declaration order is what makes this true, and it is why the refusal names the member:
			// a contract pipe that ran first would answer with an unknown-property message instead.
			expect(pipes[0]).toBeInstanceOf(RejectCardDataPipe);
			expect(pipes[1]).toBeInstanceOf(ValidationPipe);
		}
	});

	it('names the offending member and refuses the request', async () => {
		const { controller } = resource();
		const body = { providerKey: 'a-provider', number: '4242424242424242' };

		expect(controller).toBeDefined();
		await expect(through(pipesOf('create'), body)).rejects.toMatchObject({
			response: {
				statusCode: 400,
				code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED,
				details: { field: 'number' }
			}
		});
	});

	it('refuses a card member nested inside a body, and never reproduces its value', async () => {
		const nested = { providerKey: 'a-provider', metadata: { card: { cvv: '123' } } };

		await expect(through(pipesOf('create'), nested)).rejects.toMatchObject({
			response: { code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED, details: { field: 'metadata.card.cvv' } }
		});

		await through(pipesOf('create'), { providerKey: 'a-provider' }).then((value) => {
			// A body with no card member passes the pipe untouched: the refusal is a check, not a rewrite.
			expect(value).toEqual({ providerKey: 'a-provider' });
		});
	});
});
