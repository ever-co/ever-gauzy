import { ID, IOrganizationTeam, IOrganizationTeamUpdateInput } from '@gauzy/contracts';

/**
 * The organization a team is saved under. A body `organization` relation wins over `organizationId` when the team
 * is saved, so it can move the team.
 */
export function organizationIdAfterUpdate(input: IOrganizationTeamUpdateInput, storedOrganizationId: ID): ID {
	const relationOrganizationId = input.organization?.id;
	if (relationOrganizationId) {
		return relationOrganizationId;
	}
	if (input.organizationId) {
		return input.organizationId;
	}
	return storedOrganizationId;
}

/**
 * The default project an update must check. A team that moves to another organization keeps its stored default
 * project unless the body names one, so the stored one is checked against the new organization.
 */
export function defaultProjectToCheck(
	input: IOrganizationTeamUpdateInput,
	storedTeam: IOrganizationTeam,
	targetOrganizationId: ID
): ID | null | undefined {
	const keepsStoredDefaultProject = input.defaultProjectId === undefined;
	const movesOrganization = targetOrganizationId !== storedTeam.organizationId;
	if (keepsStoredDefaultProject && movesOrganization) {
		return storedTeam.defaultProjectId;
	}
	return input.defaultProjectId;
}
