import '../../../core/entities/internal';

import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { Organization, UserOrganization } from '../../../core/entities/internal';
import { assertCurrentUserBelongsToOrganization } from '../../../user-organization/assert-organization-membership';
import { OrganizationBelongsToUserConstraint } from './organization-belongs-to-user.constraint';

// The constraint chooses its ORM branch at import time from `DB_ORM`; the doubles below model TypeORM.
jest.mock('../../../core/utils', () => ({
	...jest.requireActual('../../../core/utils'),
	getORMType: () => 'typeorm'
}));

/**
 * The organization a request names, under the organization boundary (owner decision, 2026-10-22): a tenant admin
 * (`SUPER_ADMIN`, `ADMIN`) reaches every organization of the tenant, a member of it or not; anyone else only the
 * organization of their token, of which they must still be a member.
 *
 * Until now any organization the caller belonged to passed `@IsOrganizationBelongsToUser()` (REST), the GraphQL
 * membership interceptor (which asks the same constraint) and `assertCurrentUserBelongsToOrganization`: a member of
 * two organizations of a tenant read and wrote the other one by naming it, with the permissions of their role,
 * whichever organization their token was for. Both checks are run here over the same doubles.
 */

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7a000000-0000-4000-8000-00000000000b';
const USER = '7a000000-0000-4000-8000-0000000000aa';

const OWN = '7a000000-0000-4000-8000-0000000000a1';
const SIBLING = '7a000000-0000-4000-8000-0000000000a2';
const NOT_A_MEMBER = '7a000000-0000-4000-8000-0000000000a3';
const FOREIGN = '7a000000-0000-4000-8000-0000000000b1';

/** The caller is a member of `OWN` and `SIBLING`; `NOT_A_MEMBER` is an organization of the tenant they never joined. */
const MEMBERSHIPS = [
	{ tenantId: TENANT, userId: USER, organizationId: OWN },
	{ tenantId: TENANT, userId: USER, organizationId: SIBLING }
];
const ORGANIZATIONS = [
	{ id: OWN, tenantId: TENANT },
	{ id: SIBLING, tenantId: TENANT },
	{ id: NOT_A_MEMBER, tenantId: TENANT },
	{ id: FOREIGN, tenantId: OTHER_TENANT }
];

/** Rows matching every stated criterion of a `where`. */
const matching = (rows: Array<Record<string, unknown>>, where: Record<string, unknown>) =>
	rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));

/** A TypeORM entity manager over the two tables, as both checks read them. */
const manager = {
	count: async (entity: unknown, { where }: { where: Record<string, unknown> }) =>
		matching(entity === Organization ? ORGANIZATIONS : entity === UserOrganization ? MEMBERSHIPS : [], where).length
};

/** The membership repository the constraint is given. */
const memberships = {
	manager,
	findOneByOrFail: async (where: Record<string, unknown>) => {
		const [row] = matching(MEMBERSHIPS, where);
		if (!row) {
			throw new Error('EntityNotFoundError');
		}
		return row;
	}
};

/** The caller: their role and the organization of their token. */
const caller: { role: RolesEnum; organizationId: string | null } = { role: RolesEnum.EMPLOYEE, organizationId: OWN };

/** Whether each check lets the caller reach an organization. */
async function reaches(organizationId: string): Promise<{ constraint: boolean; assertion: boolean }> {
	const constraint = await new OrganizationBelongsToUserConstraint(memberships as any, {} as any).validate(
		organizationId
	);
	const assertion = await assertCurrentUserBelongsToOrganization(manager as any, organizationId).then(
		() => true,
		() => false
	);
	return { constraint, assertion };
}

const REACHED = { constraint: true, assertion: true };
const REFUSED = { constraint: false, assertion: false };

describe('The organization a request names stays inside the organization boundary', () => {
	beforeEach(() => {
		caller.role = RolesEnum.EMPLOYEE;
		caller.organizationId = OWN;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(() => caller.organizationId);
		jest.spyOn(RequestContext, 'hasRoles').mockImplementation((roles: RolesEnum[]) => roles.includes(caller.role));
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([RolesEnum.EMPLOYEE, RolesEnum.MANAGER, RolesEnum.DATA_ENTRY, RolesEnum.VIEWER])(
		'a %s reaches the organization of their token',
		async (role) => {
			caller.role = role;
			await expect(reaches(OWN)).resolves.toEqual(REACHED);
		}
	);

	it.each([RolesEnum.EMPLOYEE, RolesEnum.MANAGER, RolesEnum.DATA_ENTRY, RolesEnum.VIEWER])(
		'a %s does not reach another organization they are a member of, until they switch to it',
		async (role) => {
			caller.role = role;
			await expect(reaches(SIBLING)).resolves.toEqual(REFUSED);

			caller.organizationId = SIBLING;
			await expect(reaches(SIBLING)).resolves.toEqual(REACHED);
			await expect(reaches(OWN)).resolves.toEqual(REFUSED);
		}
	);

	it('a non-admin with no organization in their token reaches none', async () => {
		caller.organizationId = null;
		await expect(reaches(OWN)).resolves.toEqual(REFUSED);
	});

	it('a token organization the caller is no longer a member of is not reached', async () => {
		caller.organizationId = NOT_A_MEMBER;
		await expect(reaches(NOT_A_MEMBER)).resolves.toEqual(REFUSED);
	});

	it.each([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN])(
		'a tenant admin (%s) reaches every organization of the tenant, a member of it or not',
		async (role) => {
			caller.role = role;
			for (const organizationId of [OWN, SIBLING, NOT_A_MEMBER]) {
				await expect(reaches(organizationId)).resolves.toEqual(REACHED);
			}
		}
	);

	it.each([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN])(
		'a tenant admin (%s) reaches no organization of another tenant',
		async (role) => {
			caller.role = role;
			await expect(reaches(FOREIGN)).resolves.toEqual(REFUSED);
		}
	);
});
