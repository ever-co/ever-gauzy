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
 * How two employee ids are compared: `IsUUID` takes a UUID in either case, and the database answers with the one it
 * stores, so a picked teammate named in upper case is still found.
 */
function idKeyOf(id: ID | null | undefined): string {
	return String(id ?? '').toLowerCase();
}

/**
 * Whether a membership counts for a Board invitation: the membership is active and not archived (as the team service
 * reads a membership), and its employee still works. "End Work" deactivates and archives the employee but keeps their
 * team memberships (for a return), and a removed employee is not read back at all.
 */
function isWorkingMember(member: OrganizationTeamEmployee): boolean {
	const isActiveMembership = member.isActive !== false && member.isArchived !== true;
	const employee = member.employee;
	return isActiveMembership && !!employee && employee.isActive !== false && employee.isArchived !== true;
}

/**
 * The notifications of a Board invitation: one `Invitation` about the team for each picked teammate who is an active
 * member of it and still works, never for the inviter, each teammate once. The inviter must be such a member of the
 * team too, so a member can only reach the people they work with, and only in a team of their own tenant.
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
		select: {
			employeeId: true,
			isActive: true,
			isArchived: true,
			employee: { id: true, isActive: true, isArchived: true }
		},
		relations: { employee: true },
		where: { organizationTeamId: team.id, tenantId: inviter.tenantId }
	});
	// The stored id of each teammate who counts, by its comparison key
	const active = new Map(
		members.filter(isWorkingMember).map((member) => [idKeyOf(member.employeeId), member.employeeId] as const)
	);
	const inviterKey = idKeyOf(inviter.employeeId);
	if (!active.has(inviterKey)) {
		throw new ForbiddenException('Only a member of the team can invite its members to a Board.');
	}
	const receivers = [...new Set(input.receiverEmployeeIds.map(idKeyOf))]
		.filter((key) => key !== inviterKey && active.has(key))
		.map((key) => active.get(key) as ID);
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
