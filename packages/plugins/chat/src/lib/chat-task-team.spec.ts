import { NotFoundException } from '@nestjs/common';
import { ChatTeamLookup, taskTeamsOf } from './chat-task-team';

/** A lookup over stored teams that matches id, tenant and organization together, as the repository query does. */
function lookupOver(teams: Array<{ id: string; tenantId: string; organizationId: string }>) {
	return jest.fn<ReturnType<ChatTeamLookup>, Parameters<ChatTeamLookup>>(async (where) => {
		const found = teams.find((team) => team.id === where.id && team.tenantId === where.tenantId && team.organizationId === where.organizationId);
		return found ? { id: found.id } : null;
	});
}

const scope = { tenantId: 'ten', organizationId: 'org' };
const stored = [
	{ id: 'team-1', tenantId: 'ten', organizationId: 'org' },
	{ id: 'team-other-org', tenantId: 'ten', organizationId: 'org-2' },
	{ id: 'team-other-tenant', tenantId: 'ten-2', organizationId: 'org' }
];

describe('taskTeamsOf', () => {
	it("answers the named team when it is the organization's, read within the caller's tenant and organization", async () => {
		const lookup = lookupOver(stored);
		await expect(taskTeamsOf(lookup, scope, 'team-1')).resolves.toEqual([{ id: 'team-1' }]);
		expect(lookup).toHaveBeenCalledWith({ id: 'team-1', tenantId: 'ten', organizationId: 'org' });
	});

	it('refuses an unknown team with 404', async () => {
		await expect(taskTeamsOf(lookupOver(stored), scope, 'team-missing')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('refuses a team of another organization or another tenant with 404', async () => {
		await expect(taskTeamsOf(lookupOver(stored), scope, 'team-other-org')).rejects.toBeInstanceOf(NotFoundException);
		await expect(taskTeamsOf(lookupOver(stored), scope, 'team-other-tenant')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('answers no team, and reads nothing, when none is named', async () => {
		const lookup = lookupOver(stored);
		await expect(taskTeamsOf(lookup, scope, undefined)).resolves.toEqual([]);
		await expect(taskTeamsOf(lookup, scope, null)).resolves.toEqual([]);
		expect(lookup).not.toHaveBeenCalled();
	});
});
