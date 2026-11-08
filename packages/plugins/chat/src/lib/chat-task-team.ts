import { NotFoundException } from '@nestjs/common';
import type { ID } from '@gauzy/contracts';

/** Finds a team by id within a tenant and an organization; null when there is none there. */
export type ChatTeamLookup = (where: { id: ID; tenantId: ID; organizationId: ID }) => Promise<{ id: ID } | null>;

/**
 * The `teams` a task made from a message is created with. No team named: none, and nothing is read. A team named: it,
 * when it is a team of the caller's tenant and of the conversation's organization. Any other team (unknown, or of
 * another tenant or organization) is refused with 404, before the task exists.
 *
 * @param lookup Reads the team within the scope it is given.
 * @param scope The caller's tenant and the conversation's organization.
 * @param teamId The team the caller named, if any.
 * @returns The task's teams.
 */
export async function taskTeamsOf(
	lookup: ChatTeamLookup,
	scope: { tenantId: ID; organizationId: ID },
	teamId?: ID | null
): Promise<Array<{ id: ID }>> {
	if (!teamId) return [];
	const team = await lookup({ id: teamId, tenantId: scope.tenantId, organizationId: scope.organizationId });
	if (!team) throw new NotFoundException('The team was not found');
	return [{ id: team.id }];
}
