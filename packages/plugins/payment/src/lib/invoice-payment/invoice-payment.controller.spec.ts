import '@gauzy/core';
import { ExecutionContext, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { PaymentPermission } from '../payment.permissions';
import { InvoiceCheckoutDTO, InvoicePaymentConnectionDTO } from './dto';
import { InvoicePaymentController } from './invoice-payment.controller';

/**
 * Paying an invoice online is served by one controller (ever-co/ever-gauzy#11856), the platform's one surface for a
 * staff caller and an anonymous one alike: the guard and the permission on each route decide who may call it.
 *
 * What this suite pins:
 *
 * - every route answers at the path #11996 published — the README's, the public page's, and the notification URL
 *   every connector already registered was given — so folding the two controllers into one moved no URL;
 * - the settings routes ask for their grant, and the three public routes are public and clear the class's grant,
 *   which the real tenant and permission guards then let through without an account.
 */

type Handler = keyof InvoicePaymentController;

const reflector = new Reflector();
const prototype = InvoicePaymentController.prototype as unknown as Record<Handler, (...args: unknown[]) => unknown>;

/** The handlers a route is mapped to, by name. */
function routedHandlers(): Handler[] {
	// The constructor is the class itself, which carries the controller's own path
	return Object.getOwnPropertyNames(InvoicePaymentController.prototype)
		.filter((name) => name !== 'constructor')
		.filter((name) => Reflect.getMetadata(PATH_METADATA, prototype[name as Handler]) !== undefined) as Handler[];
}

/** The path a handler answers at, as Nest joins the controller's path and the handler's. */
function routeOf(handler: Handler): { method: RequestMethod; path: string } {
	const joined = [
		'',
		Reflect.getMetadata(PATH_METADATA, InvoicePaymentController),
		Reflect.getMetadata(PATH_METADATA, prototype[handler])
	]
		.join('/')
		.replace(/\/+/g, '/')
		.replace(/(.)\/$/, '$1');
	return { method: Reflect.getMetadata(METHOD_METADATA, prototype[handler]), path: joined };
}

/** The context a guard reads: the handler and its class. */
function contextOf(handler: Handler): ExecutionContext {
	return {
		getHandler: () => prototype[handler],
		getClass: () => InvoicePaymentController,
		getType: () => 'http'
	} as unknown as ExecutionContext;
}

/** The permissions a route resolves to, read the way the permission guard reads them: the handler's list first. */
function permissionsOf(handler: Handler): string[] {
	return reflector.getAllAndOverride<string[]>(PERMISSIONS_METADATA, [prototype[handler], InvoicePaymentController]);
}

const SETTINGS: Array<[Handler, RequestMethod, string, string]> = [
	['connection', RequestMethod.GET, '/invoice-payments/connection', PaymentPermission.PAYMENT_PROVIDERS_VIEW],
	['connect', RequestMethod.PUT, '/invoice-payments/connection', PaymentPermission.PAYMENT_PROVIDERS_EDIT],
	[
		'rotateSecret',
		RequestMethod.POST,
		'/invoice-payments/connection/rotate-secret',
		PaymentPermission.PAYMENT_PROVIDERS_EDIT
	]
];

const PUBLIC: Array<[Handler, RequestMethod, string]> = [
	['payOption', RequestMethod.GET, '/public/invoice-payments/invoice/:id/:token'],
	['checkout', RequestMethod.POST, '/public/invoice-payments/invoice/:id/:token/checkout'],
	['notification', RequestMethod.POST, '/public/invoice-payments/:providerId/notifications']
];

describe('InvoicePaymentController', () => {
	it('maps exactly the six routes #11996 published, each at its published path', () => {
		const published = [...SETTINGS, ...PUBLIC].map(([handler, method, path]) => ({ handler, method, path }));

		expect(routedHandlers().sort()).toEqual(published.map(({ handler }) => handler).sort());
		for (const { handler, method, path } of published) {
			expect({ handler, ...routeOf(handler) }).toEqual({ handler, method, path });
		}
	});

	it('runs under the tenant and permission guards, and asks for PAYMENT_PROVIDERS_VIEW unless a route says otherwise', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, InvoicePaymentController)).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, InvoicePaymentController)).toEqual([
			PaymentPermission.PAYMENT_PROVIDERS_VIEW
		]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, InvoicePaymentController)).toBeUndefined();
	});

	it.each(SETTINGS)(
		'%s is a settings route: not public, and asks for its own grant',
		(handler, _method, _path, permission) => {
			expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, prototype[handler])).toBeUndefined();
			expect(permissionsOf(handler)).toEqual([permission]);
		}
	);

	it.each(PUBLIC)(
		'%s needs no account: public, the class grant cleared, both guards let it through',
		async (handler) => {
			expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, prototype[handler])).toBe(true);
			expect(permissionsOf(handler)).toEqual([]);

			// Neither guard reaches its cache or the role service for a route like this: a guard that did would throw here
			const tenantGuard = new TenantPermissionGuard(undefined as never, reflector, undefined as never);
			const permissionGuard = new PermissionGuard(undefined as never, reflector, undefined as never);
			await expect(tenantGuard.canActivate(contextOf(handler))).resolves.toBe(true);
			await expect(permissionGuard.canActivate(contextOf(handler))).resolves.toBe(true);
		}
	);

	it('validates each body against the DTO it declared before the DTOs moved to ./dto', () => {
		const paramTypes = (handler: Handler): unknown[] =>
			Reflect.getMetadata('design:paramtypes', InvoicePaymentController.prototype, handler);

		expect(paramTypes('connect')).toEqual([InvoicePaymentConnectionDTO]);
		expect(paramTypes('checkout')[2]).toBe(InvoiceCheckoutDTO);
	});
});
