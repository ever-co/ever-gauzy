import { In } from 'typeorm';
import { ID, RolesEnum } from '@gauzy/contracts';

/** A team membership, as far as deciding whether it manages the team goes. */
export interface ITeamManagerMembership {
	organizationTeamId?: ID | null;
	isManager?: boolean | null;
	isActive?: boolean | null;
	isArchived?: boolean | null;
	role?: { name?: string | null } | null;
}

/** The read of the caller's memberships: `OrganizationTeamEmployeeService.find`, scoped to the caller's tenant. */
export interface ITeamMembershipReader {
	find(options: {
		where: Record<string, unknown>;
		relations?: Record<string, boolean>;
	}): Promise<ITeamManagerMembership[]>;
}

/**
 * Whether a membership makes its employee a manager of the team: the flag Ever Teams and the team routes use —
 * `isManager`, or the membership's `MANAGER` role (a team created with `managerIds` gives its managers the role and
 * leaves the flag unset, so either one counts, as in `OrganizationTeamEmployeeService.findMemberSets` and Ever Teams'
 * `useIsMemberManager`) — on a membership still in effect. Both flags are nullable, so `NULL` counts as active and not
 * archived, as `ManagedEmployeeService` reads them.
 *
 * @param membership - The membership.
 * @returns True when it is an active manager membership.
 */
export function isTeamManagerMembership(membership: ITeamManagerMembership): boolean {
	return (
		membership.isActive !== false &&
		membership.isArchived !== true &&
		(membership.isManager === true || membership.role?.name === RolesEnum.MANAGER)
	);
}

/**
 * The teams among `teamIds` that an employee manages.
 *
 * The read goes through the tenant-scoped team-member service, so a team of another tenant (or outside the caller's
 * organization boundary) is never one of them, and a deleted membership is left out as every read leaves it out.
 *
 * @param memberships - The team-member reads.
 * @param employeeId - The caller's own employee.
 * @param teamIds - The teams a write touches.
 * @returns The ones the employee manages.
 */
export async function teamsManagedBy(
	memberships: ITeamMembershipReader,
	employeeId: ID,
	teamIds: readonly ID[]
): Promise<Set<ID>> {
	if (!employeeId || !teamIds.length) {
		return new Set();
	}

	const rows = await memberships.find({
		where: { employeeId, organizationTeamId: In([...teamIds]) },
		relations: { role: true }
	});

	return new Set(rows.filter(isTeamManagerMembership).map((row) => row.organizationTeamId as ID));
}
