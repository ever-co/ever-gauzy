import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';
import { assertSensitiveRelationsAllowed } from './sensitive-relations.helper';

/**
 * The reported bypass (GHSA-c3cj-m3xm-7j5h) was a symptom: `SensitiveRelationsInterceptor` is mounted
 * on 5 of the ~83 controllers that accept a client-supplied `relations`, while EVERY tenant-scoped
 * entity exposes an `organization` relation. A request such as
 * `GET /api/equipment/pagination?relations[0]=organization.payments` — plain array form, no bypass
 * trick, a controller with no `@Permissions` at all — reached the same protected rows. These specs pin
 * the check itself; `CrudService` calls it from its read methods, and services that build their own
 * query call it directly (see crud.service.hand-rolled-relations.spec.ts).
 *
 * The walk follows the ENTITY graph, not the shape of the string, so a relation is gated by the
 * entity it is loaded from: `Organization.payments` is protected, the unrelated `Invoice.payments`
 * (which the invoices UI loads under INVOICES_VIEW) is not.
 */
describe('assertSensitiveRelationsAllowed', () => {
	/** Minimal stand-in for the slice of EntityMetadata the walk uses. */
	const entity = (name: string, relations: Record<string, () => EntityMetadata> = {}): EntityMetadata =>
		({
			name,
			tableName: name.toLowerCase(),
			findRelationWithPropertyPath: (propertyPath: string) =>
				relations[propertyPath] ? { inverseEntityMetadata: relations[propertyPath]() } : undefined
		} as unknown as EntityMetadata);

	const USER = () => entity('User');
	const PAYMENT = () => entity('Payment', { invoice: () => entity('Invoice') });
	const EMPLOYEE = () => entity('Employee', { user: USER, organization: () => ORGANIZATION() });
	const ORGANIZATION = (): EntityMetadata =>
		entity('Organization', {
			payments: PAYMENT,
			contact: () => entity('OrganizationContact'),
			employees: EMPLOYEE,
			tags: () => entity('Tag')
		});
	/** Any tenant-scoped entity: a `TenantOrganizationBaseEntity` always exposes `organization`. */
	const TAG = () => entity('Tag', { organization: ORGANIZATION, employee: EMPLOYEE, user: USER });
	/** An entity with a `payments` relation of its own, which the table must NOT gate. */
	const INVOICE = () => entity('Invoice', { payments: PAYMENT, fromOrganization: ORGANIZATION });

	let granted: PermissionsEnum[];
	let hasPermission: jest.SpyInstance;

	beforeEach(() => {
		granted = [];
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		hasPermission = jest
			.spyOn(RequestContext, 'hasPermission')
			.mockImplementation((permission: PermissionsEnum) => granted.includes(permission));
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the systemic residual: a sensitive relation reached through any entity', () => {
		it.each([
			['string array (what an ordinary client sends)', ['organization.payments']],
			['comma-separated string', 'organization.payments'],
			['nested object (the reported bypass)', { organization: { payments: { invoice: 'x' } } }],
			['array of objects', [{ organization: { payments: true } }]]
		])('refuses %s on an entity whose controller never mounted the interceptor', (_l, relations: unknown) => {
			expect(() => assertSensitiveRelationsAllowed(TAG(), relations)).toThrow(ForbiddenException);
			expect(() => assertSensitiveRelationsAllowed(TAG(), relations)).toThrow(
				new RegExp(PermissionsEnum.ORG_PAYMENT_VIEW)
			);
		});

		it('allows it once the caller holds the permission', () => {
			granted = [PermissionsEnum.ORG_PAYMENT_VIEW];

			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization.payments'])).not.toThrow();
		});

		it('re-arms the table at an organization reached deeper in the path', () => {
			expect(() => assertSensitiveRelationsAllowed(TAG(), ['employee.organization.payments'])).toThrow(
				ForbiddenException
			);
		});
	});

	describe('an entity that IS the organization', () => {
		it('gates the relations the table declares at the top level', () => {
			expect(() => assertSensitiveRelationsAllowed(ORGANIZATION(), ['contact'])).toThrow(
				new RegExp(PermissionsEnum.ORG_CONTACT_VIEW)
			);

			granted = [PermissionsEnum.ORG_CONTACT_VIEW];
			expect(() => assertSensitiveRelationsAllowed(ORGANIZATION(), ['contact'])).not.toThrow();
		});
	});

	describe('nested declarations', () => {
		it('requires the permission the nested node declares, not only its parent', () => {
			granted = [PermissionsEnum.ORG_EMPLOYEES_VIEW];

			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization.employees'])).not.toThrow();
			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization.employees.user'])).toThrow(
				new RegExp(PermissionsEnum.ORG_USERS_VIEW)
			);

			granted = [PermissionsEnum.ORG_EMPLOYEES_VIEW, PermissionsEnum.ORG_USERS_VIEW];
			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization.employees.user'])).not.toThrow();
		});
	});

	describe('regression: ordinary requests keep working', () => {
		it('allows the relation shape the Angular organization selector sends', () => {
			// `relations[0]=organization&relations[1]=organization.contact`, the request every page makes.
			granted = [PermissionsEnum.ORG_CONTACT_VIEW];

			expect(() =>
				assertSensitiveRelationsAllowed(TAG(), ['organization', 'organization.contact'])
			).not.toThrow();
		});

		it('does not gate a same-named relation on a different entity', () => {
			// Invoice.payments is the invoices UI's own relation, gated by INVOICES_VIEW on its
			// controller — the organization table must not reach it.
			expect(() => assertSensitiveRelationsAllowed(INVOICE(), ['payments'])).not.toThrow();
			expect(() => assertSensitiveRelationsAllowed(INVOICE(), ['payments.invoice'])).not.toThrow();
		});

		it('allows a plain hop to the organization', () => {
			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization', 'user'])).not.toThrow();
		});

		it('never verifies a token for a request that names no sensitive relation', () => {
			assertSensitiveRelationsAllowed(TAG(), ['user', 'organization']);

			expect(hasPermission).not.toHaveBeenCalled();
		});

		it('gates a relation the entity graph cannot resolve without throwing on it', () => {
			// TypeORM rejects an unknown property path itself; the walk simply stops there.
			expect(() => assertSensitiveRelationsAllowed(TAG(), ['nowhere.payments'])).not.toThrow();
		});
	});

	describe('inputs that must not reach a permission check', () => {
		it('ignores reads that carry no relations and repositories with no metadata', () => {
			expect(() => assertSensitiveRelationsAllowed(TAG(), undefined)).not.toThrow();
			expect(() => assertSensitiveRelationsAllowed(TAG(), null)).not.toThrow();
			expect(() => assertSensitiveRelationsAllowed(undefined, ['organization.payments'])).not.toThrow();
			expect(hasPermission).not.toHaveBeenCalled();
		});

		it('skips server-side reads that run outside a request', () => {
			// Seeders, migrations and schedulers build their own options in code; there is no caller
			// whose permissions could be consulted and no client-supplied `relations` to distrust.
			(RequestContext.currentRequestContext as unknown as jest.SpyInstance).mockReturnValue(undefined);

			expect(() => assertSensitiveRelationsAllowed(TAG(), ['organization.payments'])).not.toThrow();
		});

		it('does not let a structure nested past the depth bound smuggle a relation past the walk', () => {
			// `Organization.tags` ↔ `Tag.organization` is a real cycle, so an attacker can chain hops
			// until the canonicalization gives up and hang `payments` off the far end. Giving up must
			// refuse the read, not wave the deeper hops through while the ORM joins them.
			let relations: unknown = { payments: { invoice: 'x' } };
			for (let i = 21; i > 0; i--) {
				relations = { [i % 2 === 1 ? 'organization' : 'tags']: relations };
			}

			expect(() => assertSensitiveRelationsAllowed(TAG(), relations)).toThrow(BadRequestException);
		});

		it('refuses a prototype-polluting key rather than skipping the branch it hides', () => {
			// The sink does not rewrite the value it checks, so a skipped branch would still reach the ORM.
			const polluted = JSON.parse('{"organization":{"__proto__":{"payments":true}}}');

			expect(() => assertSensitiveRelationsAllowed(TAG(), polluted)).toThrow(BadRequestException);
			expect(({} as any).payments).toBeUndefined();
		});
	});
});
