import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, ID, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { OrganizationTeam, OrganizationTeamEmployee } from '../core/entities/internal';

/** The most teammates one Board invitation names. */
export const MAX_BOARD_INVITEES = 50;

/** The longest team name and actor name a title quotes: the title column holds 255 characters on MySQL. */
const MAX_TEAM_NAME_LENGTH = 120;
const MAX_ACTOR_NAME_LENGTH = 80;

/**
 * Who a member invites to a Board they open from Ever Teams (ever-co/ever-teams#5022): the teammates they picked, in
 * the team the Board is opened from.
 */
export class BoardInvitationDTO {
	@ApiProperty({
		type: () => String,
		description: 'The team the Board is opened from, which inviter and invitees share.'
	})
	@IsUUID()
	readonly organizationTeamId: ID;

	@ApiProperty({
		type: () => String,
		isArray: true,
		description: `The teammates invited, at most ${MAX_BOARD_INVITEES}.`
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_BOARD_INVITEES)
	@IsUUID('all', { each: true })
	readonly receiverEmployeeIds: ID[];
}

function shortened(name: string | null | undefined, max: number): string {
	const text = (name ?? '').replace(/\s+/g, ' ').trim();
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The title of a Board invitation, in English as the platform's notification titles are: `Ana Invited you to a Board
 * with the Team "Design"`. Ever Teams reads the Board from it (` to a Board `), and the team as the entry's subject.
 */
export function boardInvitationTitle(actorName: string, teamName: string | null | undefined): string {
	return `${shortened(actorName, MAX_ACTOR_NAME_LENGTH) || 'Someone'} Invited you to a Board with the Team "${shortened(
		teamName,
		MAX_TEAM_NAME_LENGTH
	)}"`;
}

/**
 * The notifications of a Board invitation: one `Invitation` about the team for each picked teammate who is an active
 * member of it, never for the inviter, each teammate once. The inviter must be an active member of the team too, so a
 * member can only reach the people they work with, and only in a team of their own tenant.
 *
 * @param dataSource The database the team and its memberships are read from.
 * @param input The team and the picked teammates.
 * @param inviter The inviting employee, their name, and the tenant of the request.
 * @throws ForbiddenException when the inviter is no active member of the team; NotFoundException when the team is not
 * one of the tenant's.
 */
export async function boardInvitationsOf(
	dataSource: DataSource,
	input: BoardInvitationDTO,
	inviter: { employeeId: ID; name: string; tenantId: ID }
): Promise<IEmployeeNotificationCreateInput[]> {
	const team = await dataSource.getRepository(OrganizationTeam).findOne({
		select: { id: true, name: true, organizationId: true, tenantId: true },
		where: { id: input.organizationTeamId, tenantId: inviter.tenantId }
	});
	if (!team) {
		throw new NotFoundException('The team was not found.');
	}
	const members = await dataSource.getRepository(OrganizationTeamEmployee).find({
		select: { employeeId: true, isActive: true },
		where: { organizationTeamId: team.id, tenantId: inviter.tenantId }
	});
	const active = new Set(
		members.filter((member) => member.isActive !== false).map((member) => String(member.employeeId))
	);
	if (!active.has(String(inviter.employeeId))) {
		throw new ForbiddenException('Only a member of the team can invite its members to a Board.');
	}
	const receivers = [...new Set(input.receiverEmployeeIds.map(String))].filter(
		(employeeId) => employeeId !== String(inviter.employeeId) && active.has(employeeId)
	);
	const title = boardInvitationTitle(inviter.name, team.name);
	return receivers.map((receiverEmployeeId) => ({
		type: EmployeeNotificationTypeEnum.INVITATION,
		entity: BaseEntityEnum.OrganizationTeam,
		entityId: team.id,
		title,
		receiverEmployeeId,
		sentByEmployeeId: inviter.employeeId,
		organizationId: team.organizationId,
		tenantId: team.tenantId
	}));
}
