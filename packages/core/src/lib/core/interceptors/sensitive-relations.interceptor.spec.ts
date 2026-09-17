import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException } from '@nestjs/common';
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

	describe('a node that declares both its own permission and nested ones', () => {
		// `employees: { _self: ORG_EMPLOYEES_VIEW, user: ORG_USERS_VIEW }`. The lookup used to return the
		// `_self` it met first and stop, so a caller holding only ORG_EMPLOYEES_VIEW could load the
		// employees' user accounts as well.
		beforeEach(() =>
			hasPermission.mockImplementation(
				(permission: PermissionsEnum) => permission === PermissionsEnum.ORG_EMPLOYEES_VIEW
			)
		);

		it.each([
			['nested object', { organization: { employees: { user: true } } }],
			['string array', ['organization.employees.user']],
			['comma-separated string', 'organization.employees,organization.employees.user']
		])('refuses the nested relation in the %s form with only the parent permission', (_label, relations) => {
			expect(() => intercept(relations)).toThrow(new RegExp(PermissionsEnum.ORG_USERS_VIEW));
			expect(handled).toBe(false);
		});

		it('still allows the parent relation itself', () => {
			expect(() => intercept(['organization.employees'])).not.toThrow();
			expect(handled).toBe(true);
		});

		it('applies the parent permission to an undeclared relation below it', () => {
			hasPermission.mockReturnValue(false);

			expect(() => intercept({ organization: { employees: { tags: true } } })).toThrow(
				new RegExp(PermissionsEnum.ORG_EMPLOYEES_VIEW)
			);
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

		it('refuses a prototype-polluting branch instead of trusting or silently dropping it', () => {
			const polluted = JSON.parse('{"__proto__":{"payments":true}}');

			expect(() => intercept(polluted)).toThrow(BadRequestException);
			expect(handled).toBe(false);
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
