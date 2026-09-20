import '../../../core/entities/internal';

import { ValidationArguments } from 'class-validator';
import { RequestContext } from '../../../core/context';
import { EmployeeBelongsToOrganizationConstraint } from './employee-belongs-to-organization.constraint';
import { OrganizationBelongsToUserConstraint } from './organization-belongs-to-user.constraint';

// The constraints choose their ORM branch at import time from `DB_ORM`; the doubles below model the
// TypeORM repositories, so pin the branch rather than let a developer's `DB_ORM=mikro-orm` change the
// verdicts of this suite.
jest.mock('../../../core/utils', () => ({
	...jest.requireActual('../../../core/utils'),
	getORMType: () => 'typeorm'
}));

/**
 * GHSA-44pv-34gx-q9p4 — TypeORM drops a `where` key whose value is `undefined`
 * (`invalidWhereValuesBehavior.undefined: 'ignore'`, kept on purpose as the optional-filter idiom), so
 * every lookup has to prove its key is present.
 *
 * `OrganizationBelongsToUserConstraint` did not: handed an organization OBJECT it read `value.id`, and
 * an object without one (`organization: {}`, `{ id: null }`, or a relation filter such as
 * `{ isActive: true }`) made it issue `findOneByOrFail({ tenantId, userId, organizationId: undefined })`.
 * That matched ANY membership the caller has and returned true — while a truthy `organization` also
 * switched OFF the `organizationId` validator of `TenantOrganizationBaseDTO`. The request named no
 * organization at all and still cleared the membership check.
 *
 * `EmployeeBelongsToOrganizationConstraint` had the mirror image: with no resolvable organization it
 * returned true, so an employee of any organization — or any tenant — was accepted.
 *
 * The repository doubles below reproduce the ORM behaviour that made this exploitable, rather than
 * asserting on the arguments: `undefinedDropping` removes undefined keys exactly as TypeORM does.
 */

const TENANT_ID = '3f0c1d2e-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '3f0c1d2e-0000-4000-8000-000000000002';
const USER_ID = '3f0c1d2e-0000-4000-8000-0000000000a1';

const OWN_ORGANIZATION_ID = '3f0c1d2e-0000-4000-8000-0000000000b1';
const SIBLING_ORGANIZATION_ID = '3f0c1d2e-0000-4000-8000-0000000000b2';
const FOREIGN_ORGANIZATION_ID = '3f0c1d2e-0000-4000-8000-0000000000b3';

const MEMBERSHIPS = [
	{ tenantId: TENANT_ID, userId: USER_ID, organizationId: OWN_ORGANIZATION_ID },
	{ tenantId: OTHER_TENANT_ID, userId: 'someone-else', organizationId: FOREIGN_ORGANIZATION_ID }
];

const EMPLOYEES = [
	{ id: 'employee-own', tenantId: TENANT_ID, organizationId: OWN_ORGANIZATION_ID },
	{ id: 'employee-sibling', tenantId: TENANT_ID, organizationId: SIBLING_ORGANIZATION_ID },
	{ id: 'employee-foreign', tenantId: OTHER_TENANT_ID, organizationId: FOREIGN_ORGANIZATION_ID }
];

/** Drops `undefined` keys from the criteria, the way TypeORM does before building the SQL. */
function undefinedDropping<T extends Record<string, any>>(rows: T[]) {
	return async (where: Record<string, any>): Promise<T> => {
		const criteria = Object.entries(where).filter(([, value]) => value !== undefined);
		const match = rows.find((row) => criteria.every(([key, value]) => row[key] === value));

		if (!match) {
			throw new Error('EntityNotFoundError');
		}
		return match;
	};
}

describe('OrganizationBelongsToUserConstraint', () => {
	const findOneByOrFail = undefinedDropping(MEMBERSHIPS);
	const constraint = new OrganizationBelongsToUserConstraint({ findOneByOrFail } as any, {} as any);

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	/** `validate()` exactly as it stood before the fix, over the same repository double. */
	const legacyValidate = async (value: any): Promise<boolean> => {
		// `isEmpty` from @gauzy/utils treats `{}`, `{ id: null }` and `{ id: '' }` as empty.
		const isEmptyValue =
			value === null ||
			value === undefined ||
			(typeof value === 'object' &&
				Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
					.length === 0);

		if (isEmptyValue) {
			return true;
		}
		try {
			await findOneByOrFail({
				tenantId: TENANT_ID,
				userId: USER_ID,
				organizationId: typeof value === 'string' ? value : value.id
			});
			return true;
		} catch {
			return false;
		}
	};

	it.each([
		['a relation filter', { isActive: true }],
		['an empty object', {}],
		['a null id', { id: null }],
		['an empty id', { id: '' }]
	])('refuses an organization object that names no organization: %s', async (_label, value) => {
		await expect(constraint.validate(value as any)).resolves.toBe(false);
	});

	it.each([
		['a relation filter', { isActive: true }],
		['an empty object', {}],
		['a null id', { id: null }],
		['an empty id', { id: '' }]
	])('CONTROL: the pre-fix validator accepted %s', async (_label, value) => {
		await expect(legacyValidate(value)).resolves.toBe(true);
	});

	it('accepts an organization object of the caller', async () => {
		await expect(constraint.validate({ id: OWN_ORGANIZATION_ID } as any)).resolves.toBe(true);
	});

	it('refuses an organization the caller is not a member of', async () => {
		await expect(constraint.validate({ id: FOREIGN_ORGANIZATION_ID } as any)).resolves.toBe(false);
		await expect(constraint.validate(FOREIGN_ORGANIZATION_ID)).resolves.toBe(false);
	});

	it('accepts a plain organization id of the caller, and leaves an absent one to @IsOptional', async () => {
		await expect(constraint.validate(OWN_ORGANIZATION_ID)).resolves.toBe(true);
		await expect(constraint.validate(undefined as any)).resolves.toBe(true);
		await expect(constraint.validate('' as any)).resolves.toBe(true);
	});

	it('never issues the membership lookup with an empty organization id', async () => {
		await expect(constraint.checkOrganizationExistence(undefined as any)).resolves.toBe(false);
		await expect(constraint.checkOrganizationExistence('')).resolves.toBe(false);

		// CONTROL: the same criteria against the ORM double matched the FIRST membership of the caller.
		await expect(
			findOneByOrFail({ tenantId: TENANT_ID, userId: USER_ID, organizationId: undefined })
		).resolves.toEqual(MEMBERSHIPS[0]);
	});

	it('fails closed without an authenticated tenant user', async () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		await expect(constraint.validate({ id: OWN_ORGANIZATION_ID } as any)).resolves.toBe(false);
	});
});

describe('EmployeeBelongsToOrganizationConstraint', () => {
	const findOneByOrFail = undefinedDropping(EMPLOYEES);
	const constraint = new EmployeeBelongsToOrganizationConstraint({ findOneByOrFail } as any, {} as any);

	const args = (object: Record<string, unknown>) => ({ object }) as ValidationArguments;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['a relation filter', { isActive: true }],
		['an empty object', {}],
		['a null id', { id: null }]
	])('refuses an employee when the payload names an organization with no usable id: %s', async (_label, organization) => {
		// Such an object is truthy, so it also switched off the `organizationId` validator of
		// TenantOrganizationBaseDTO: the lookup ran with an undefined organization predicate, which
		// TypeORM drops, and accepted an employee of any organization of the tenant.
		await expect(constraint.validate('employee-sibling', args({ organization }))).resolves.toBe(false);
	});

	it('CONTROL: the pre-fix check returned true for each of those, and the lookup matched any employee', async () => {
		const legacyValidate = async (object: {
			organizationId?: string;
			organization?: { id?: string };
		}): Promise<boolean> => {
			const organizationId = object.organizationId || object.organization?.id;
			if (!organizationId) return true; // the pre-fix early-out
			return false;
		};

		await expect(legacyValidate({ organization: { isActive: true } as any })).resolves.toBe(true);
		await expect(legacyValidate({ organization: {} })).resolves.toBe(true);
		// ... and even without the early-out, the undefined organization key was dropped from the SQL.
		await expect(
			findOneByOrFail({ id: 'employee-foreign', organizationId: undefined, tenantId: OTHER_TENANT_ID })
		).resolves.toEqual(EMPLOYEES[2]);
	});

	it('leaves a payload that names NO organization to the DTO and the service', async () => {
		// Deliberately permissive: organization-level records, and the `sentTo` payloads the invoice flows
		// send, legitimately carry no organization, and `TenantOrganizationBaseDTO` is what requires one.
		// The residual is documented in the advisory notes.
		await expect(constraint.validate('employee-sibling', args({ sentTo: 'contact-1' }))).resolves.toBe(true);
		await expect(constraint.validate('employee-foreign', args({}))).resolves.toBe(true);
	});

	it('keeps accepting an employee of the organization the payload names', async () => {
		await expect(constraint.validate('employee-own', args({ organizationId: OWN_ORGANIZATION_ID }))).resolves.toBe(
			true
		);
		await expect(
			constraint.validate({ id: 'employee-own' } as any, args({ organization: { id: OWN_ORGANIZATION_ID } }))
		).resolves.toBe(true);
	});

	it('refuses an employee of another organization or another tenant', async () => {
		await expect(
			constraint.validate('employee-sibling', args({ organizationId: OWN_ORGANIZATION_ID }))
		).resolves.toBe(false);
		await expect(
			constraint.validate('employee-foreign', args({ organizationId: FOREIGN_ORGANIZATION_ID }))
		).resolves.toBe(false);
	});

	it('keeps accepting an organization-level record, which carries no employee at all', async () => {
		// The UI ships an ALL_EMPLOYEES_SELECTED sentinel: a non-empty object with an empty id.
		await expect(
			constraint.validate(
				{ id: null, firstName: 'All Employees' } as any,
				args({ organizationId: OWN_ORGANIZATION_ID })
			)
		).resolves.toBe(true);
		await expect(constraint.validate(undefined as any, args({}))).resolves.toBe(true);
	});
});
