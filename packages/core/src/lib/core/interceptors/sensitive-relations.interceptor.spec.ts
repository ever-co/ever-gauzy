import { CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import {
	SENSITIVE_RELATIONS_KEY,
	SENSITIVE_RELATIONS_ROOT_KEY
} from '../decorators/sensitive-relations.decorator';
import { ORGANIZATION_SENSITIVE_RELATIONS } from '../util/organization-sensitive-relations.config';
import { SensitiveRelationsInterceptor } from './sensitive-relations.interceptor';

/**
 * The interceptor used to understand exactly two representations of `relations` — an array and a
 * comma-separated string — while Express's extended query parser turns
 * `?relations[organization][payments][invoice]=x` into a nested OBJECT and TypeORM joins that object
 * level by level, selecting every column. The permission loop therefore ran zero times on the one
 * shape that mattered (GHSA-c3cj-m3xm-7j5h).
 *
 * Every case below is expressed in all four shapes so the check can never again depend on which one
 * the caller picked.
 */
describe('SensitiveRelationsInterceptor', () => {
	const CONTROLLER = class UserOrganizationController {};
	const HANDLER = function findAll() {};

	let interceptor: SensitiveRelationsInterceptor;
	let handled: boolean;
	let hasPermission: jest.SpyInstance;

	/** A Reflector that answers for the controller class only, like `@SensitiveRelations` on a class. */
	const reflectorFor = (rootKey?: string): Reflector =>
		({
			get: (key: string, target: unknown) => {
				if (target !== CONTROLLER) return undefined;
				if (key === SENSITIVE_RELATIONS_KEY) return ORGANIZATION_SENSITIVE_RELATIONS;
				if (key === SENSITIVE_RELATIONS_ROOT_KEY) return rootKey;
				return undefined;
			}
		} as unknown as Reflector);

	const contextFor = (request: unknown): ExecutionContext =>
		({
			getHandler: () => HANDLER,
			getClass: () => CONTROLLER,
			switchToHttp: () => ({ getRequest: () => request })
		} as unknown as ExecutionContext);

	const next: CallHandler = {
		handle: () => {
			handled = true;
			return of('ok');
		}
	};

	/** Runs the interceptor for a `relations` value supplied on the query string. */
	const intercept = (relations: unknown, rootKey: string | undefined = 'organization') => {
		interceptor = new SensitiveRelationsInterceptor(reflectorFor(rootKey));
		return interceptor.intercept(contextFor({ query: { relations }, body: {} }), next);
	};

	beforeEach(() => {
		handled = false;
		hasPermission = jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('without the required permission', () => {
		const forbidden = 'ORG_PAYMENT_VIEW';

		it.each([
			['nested object (the reported bypass)', { organization: { payments: { invoice: 'x' } } }],
			['object with a boolean leaf', { organization: { payments: true } }],
			['object with a string leaf', { organization: { payments: 'x' } }],
			['string array', ['organization.payments']],
			['comma-separated string', 'organization.payments'],
			['array of objects', [{ organization: { payments: true } }]],
			['array nested under an object key', { organization: ['payments'] }]
		])('refuses the %s form', (_label: string, relations: unknown) => {
			expect(() => intercept(relations)).toThrow(ForbiddenException);
			expect(() => intercept(relations)).toThrow(new RegExp(forbidden));
			expect(handled).toBe(false);
		});

		it('refuses a sensitive relation supplied in the request body', () => {
			interceptor = new SensitiveRelationsInterceptor(reflectorFor('organization'));
			const context = contextFor({ query: {}, body: { relations: { organization: { payments: true } } } });

			expect(() => interceptor.intercept(context, next)).toThrow(ForbiddenException);
			expect(handled).toBe(false);
		});

		it('refuses a deeper sensitive relation declared under a nested config node', () => {
			expect(() => intercept({ organization: { employees: { user: true } } })).toThrow(ForbiddenException);
		});

		it('refuses the sensitive relation on a controller that declares no root key', () => {
			// OrganizationController mounts the table without a rootKey, so the path is direct.
			expect(() => intercept({ payments: { invoice: 'x' } }, undefined)).toThrow(ForbiddenException);
		});
	});

	describe('with the required permission', () => {
		beforeEach(() => hasPermission.mockReturnValue(true));

		it.each([
			['nested object', { organization: { payments: { invoice: 'x' } } }],
			['string array', ['organization.payments']],
			['comma-separated string', 'organization.payments']
		])('allows the %s form', (_label: string, relations: unknown) => {
			expect(() => intercept(relations)).not.toThrow();
			expect(handled).toBe(true);
		});
	});

	describe('relations that are not sensitive', () => {
		it.each([
			['the organization itself', { organization: true }],
			['the organization in array form', ['organization']],
			['an unconfigured relation', ['user']],
			['the UI-shaped request', ['user', 'organization']],
			['no relations at all', undefined]
		])('allows %s without any permission', (_label: string, relations: unknown) => {
			expect(() => intercept(relations)).not.toThrow();
			expect(handled).toBe(true);
		});

		it('drops a prototype-polluting branch instead of trusting it', () => {
			const polluted = JSON.parse('{"__proto__":{"payments":true}}');

			expect(() => intercept(polluted)).not.toThrow();
			expect(({} as any).payments).toBeUndefined();
		});
	});

	it('does nothing when the controller declares no config', () => {
		const bare = new SensitiveRelationsInterceptor({ get: () => undefined } as unknown as Reflector);

		expect(() =>
			bare.intercept(contextFor({ query: { relations: { organization: { payments: true } } } }), next)
		).not.toThrow();
		expect(handled).toBe(true);
	});

	it('reports the permission the table declares', () => {
		expect(() => intercept({ organization: { contact: true } })).toThrow(
			new RegExp(PermissionsEnum.ORG_CONTACT_VIEW)
		);
	});
});
