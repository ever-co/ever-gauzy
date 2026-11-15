import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, EmployeeNotificationTypeEnum } from '@gauzy/contracts';
import { boardInvitationsOf, boardInvitationTitle } from './board-invitation';

/**
 * A member who opens a Board from Ever Teams with teammates invites them through their Inbox (ever-co/ever-teams#5022):
 * only teammates of a team the member is in, each once, never the member themselves.
 */
describe('boardInvitationsOf', () => {
	const TENANT = 'tenant-1';
	const team = { id: 'team-1', name: 'Design', organizationId: 'org-1', tenantId: TENANT };

	function dataSourceWith(members: Array<{ employeeId: string; isActive?: boolean }>, found = true) {
		const findOne = jest.fn(async () => (found ? team : null));
		const find = jest.fn(async () => members);
		return {
			dataSource: {
				getRepository: jest.fn((entity: { name: string }) =>
					entity.name === 'OrganizationTeam' ? { findOne } : { find }
				)
			},
			findOne,
			find
		};
	}

	const inviter = { employeeId: 'employee-ana', name: 'Ana Lima', tenantId: TENANT };

	it('files one Invitation about the team for each picked active teammate, as the inviter', async () => {
		const { dataSource, findOne } = dataSourceWith([
			{ employeeId: 'employee-ana' },
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-2', isActive: true },
			{ employeeId: 'employee-gone', isActive: false }
		]);

		const invitations = await boardInvitationsOf(
			dataSource as never,
			{
				organizationTeamId: 'team-1',
				receiverEmployeeIds: [
					'employee-1',
					'employee-2',
					'employee-1',
					'employee-ana',
					'employee-gone',
					'employee-stranger'
				]
			},
			inviter
		);

		expect(invitations).toEqual([
			{
				type: EmployeeNotificationTypeEnum.INVITATION,
				entity: BaseEntityEnum.OrganizationTeam,
				entityId: 'team-1',
				title: 'Ana Lima Invited you to a Board with the Team "Design"',
				receiverEmployeeId: 'employee-1',
				sentByEmployeeId: 'employee-ana',
				organizationId: 'org-1',
				tenantId: TENANT
			},
			expect.objectContaining({ receiverEmployeeId: 'employee-2' })
		]);
		// The team is read in the inviter's tenant only
		expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'team-1', tenantId: TENANT } }));
	});

	it('refuses an inviter who is no active member of the team', async () => {
		const { dataSource } = dataSourceWith([
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-ana', isActive: false }
		]);

		await expect(
			boardInvitationsOf(
				dataSource as never,
				{ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1'] },
				inviter
			)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses a team of another tenant, or one that does not exist', async () => {
		const { dataSource } = dataSourceWith([], false);

		await expect(
			boardInvitationsOf(
				dataSource as never,
				{ organizationTeamId: 'team-x', receiverEmployeeIds: ['employee-1'] },
				inviter
			)
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('shortens long names so the title fits its column', () => {
		const title = boardInvitationTitle('a'.repeat(255), 't'.repeat(255));
		expect(title.length).toBeLessThanOrEqual(255);
		expect(title).toMatch(/^a+… Invited you to a Board with the Team "t+…"$/);
		expect(boardInvitationTitle('', 'Design')).toBe('Someone Invited you to a Board with the Team "Design"');
	});
});
