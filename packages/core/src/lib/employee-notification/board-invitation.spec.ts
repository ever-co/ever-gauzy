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

	type Member = {
		employeeId: string;
		isActive?: boolean;
		isArchived?: boolean;
		employee?: { isActive?: boolean; isArchived?: boolean } | null;
	};

	/** The memberships as read back: each with its employee, who still works unless the test says otherwise. */
	function dataSourceWith(members: Member[], found = true) {
		const findOne = jest.fn(async () => (found ? team : null));
		const find = jest.fn(async () =>
			members.map((member) =>
				'employee' in member ? member : { ...member, employee: { isActive: true, isArchived: false } }
			)
		);
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

	it('leaves out a teammate who no longer works, as End Work keeps their memberships', async () => {
		const { dataSource, find } = dataSourceWith([
			{ employeeId: 'employee-ana' },
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-ended', employee: { isActive: false, isArchived: true } },
			{ employeeId: 'employee-archived', employee: { isActive: true, isArchived: true } },
			{ employeeId: 'employee-removed', employee: null }
		]);

		const invitations = await boardInvitationsOf(
			dataSource as never,
			{
				organizationTeamId: 'team-1',
				receiverEmployeeIds: ['employee-1', 'employee-ended', 'employee-archived', 'employee-removed']
			},
			inviter
		);

		expect(invitations.map((invitation) => invitation.receiverEmployeeId)).toEqual(['employee-1']);
		// The employee of each membership is read with it
		expect(find).toHaveBeenCalledWith(expect.objectContaining({ relations: { employee: true } }));
	});

	it('leaves out an archived membership, and refuses an inviter whose membership is archived', async () => {
		const { dataSource } = dataSourceWith([
			{ employeeId: 'employee-ana' },
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-archived', isArchived: true }
		]);

		const invitations = await boardInvitationsOf(
			dataSource as never,
			{ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1', 'employee-archived'] },
			inviter
		);
		expect(invitations.map((invitation) => invitation.receiverEmployeeId)).toEqual(['employee-1']);

		const archivedInviter = dataSourceWith([
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-ana', isArchived: true }
		]);
		await expect(
			boardInvitationsOf(
				archivedInviter.dataSource as never,
				{ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1'] },
				inviter
			)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('finds a picked teammate, and the inviter, whatever the case of their id', async () => {
		const ana = '0b6f2c1e-6a35-4c1e-9b8e-3f1d2a4c5b6a';
		const bea = '550e8400-e29b-41d4-a716-446655440000';
		const { dataSource } = dataSourceWith([{ employeeId: ana }, { employeeId: bea }]);

		const invitations = await boardInvitationsOf(
			dataSource as never,
			{ organizationTeamId: 'team-1', receiverEmployeeIds: [bea.toUpperCase(), bea, ana] },
			{ ...inviter, employeeId: ana.toUpperCase() }
		);

		// One invitation, addressed with the id the database stores
		expect(invitations.map((invitation) => invitation.receiverEmployeeId)).toEqual([bea]);
	});

	it('refuses an inviter who no longer works', async () => {
		const { dataSource } = dataSourceWith([
			{ employeeId: 'employee-1' },
			{ employeeId: 'employee-ana', employee: { isActive: false, isArchived: true } }
		]);

		await expect(
			boardInvitationsOf(
				dataSource as never,
				{ organizationTeamId: 'team-1', receiverEmployeeIds: ['employee-1'] },
				inviter
			)
		).rejects.toBeInstanceOf(ForbiddenException);
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
