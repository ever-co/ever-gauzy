import { Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { ID, InboxMailboxMemberRoleEnum, InboxMailboxOwnerTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { InboxMailbox } from '../entities/inbox-mailbox.entity';
import { InboxMailboxMember } from '../entities/inbox-mailbox-member.entity';

/** The most recipients one mailbox's message is delivered to. */
export const MAX_MAILBOX_RECIPIENTS = 500;

/**
 * Who a mailbox's mail is for, and who may read or manage it (plan 04 §2, §5.3, §5.4).
 *
 * - An employee mailbox: the employee's user, and the mailbox's members.
 * - A shared mailbox: its members; with none, a team mailbox falls back to the team's members, an organization
 *   mailbox to the organization's users whose role grants `INBOX_MAILBOX_MANAGE`.
 *
 * Reading a message needs one of those, or `INBOX_MAILBOX_READ_ALL` in the mailbox's tenant. Managing it (the raw
 * message, the quarantine) needs the employee owner, a `MANAGER` member, `INBOX_MAILBOX_READ_ALL`, or
 * `INBOX_MAILBOX_MANAGE` as a member of the mailbox's organization.
 *
 * Everyone is checked against the current state: for a mailbox of an organization, only users who are still active
 * members of that organization count (a user removed from it keeps their saved mailbox membership, which then grants
 * nothing until they are back).
 */
@Injectable()
export class InboxMailboxAccessService {
	constructor(private readonly dataSource: DataSource) {}

	/** The active mailboxes with these addresses (lower-case, as stored). */
	async findActiveByAddresses(addresses: string[]): Promise<InboxMailbox[]> {
		if (addresses.length === 0) return [];
		const rows = await this.dataSource.getRepository(InboxMailbox).find({
			where: { address: In(addresses.slice(0, 200)), deletedAt: IsNull() }
		});
		return rows.filter((row) => row.isActive !== false && row.isArchived !== true);
	}

	/** The users a mailbox's message is delivered to. */
	async recipientsOf(mailbox: InboxMailbox): Promise<ID[]> {
		const users = new Set<ID>(await this.current(mailbox, await this.memberUserIds(mailbox)));
		if (mailbox.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE && mailbox.ownerEmployeeId) {
			const owner = await this.employeeUserId(mailbox.tenantId as ID, mailbox.ownerEmployeeId);
			if (owner) users.add(owner);
		} else if (users.size === 0 && mailbox.ownerType === InboxMailboxOwnerTypeEnum.TEAM && mailbox.ownerTeamId) {
			for (const id of await this.teamUserIds(mailbox.tenantId as ID, mailbox.ownerTeamId)) users.add(id);
		} else if (
			users.size === 0 &&
			mailbox.ownerType === InboxMailboxOwnerTypeEnum.ORGANIZATION &&
			mailbox.organizationId
		) {
			for (const id of await this.organizationManagerIds(mailbox.tenantId as ID, mailbox.organizationId as ID)) {
				users.add(id);
			}
		}
		return (await this.current(mailbox, [...users])).slice(0, MAX_MAILBOX_RECIPIENTS);
	}

	/** Whether the caller may read the mailbox's messages. */
	async canRead(mailbox: InboxMailbox, userId: ID): Promise<boolean> {
		if (RequestContext.hasPermission(PermissionsEnum.INBOX_MAILBOX_READ_ALL)) return true;
		return (await this.recipientsOf(mailbox)).includes(userId);
	}

	/** Whether the caller may manage the mailbox (download the raw message, release the quarantine). */
	async canManage(mailbox: InboxMailbox, userId: ID): Promise<boolean> {
		if (RequestContext.hasPermission(PermissionsEnum.INBOX_MAILBOX_READ_ALL)) return true;
		const stillMember = async () => (await this.current(mailbox, [userId])).length > 0;
		if (mailbox.ownerType === InboxMailboxOwnerTypeEnum.EMPLOYEE && mailbox.ownerEmployeeId) {
			if (
				(await this.employeeUserId(mailbox.tenantId as ID, mailbox.ownerEmployeeId)) === userId &&
				(await stillMember())
			) {
				return true;
			}
		}
		const member = await this.dataSource
			.getRepository(InboxMailboxMember)
			.findOne({ where: { mailboxId: mailbox.id as ID, userId, deletedAt: IsNull() } });
		if (member?.role === InboxMailboxMemberRoleEnum.MANAGER && (await stillMember())) return true;
		if (!RequestContext.hasPermission(PermissionsEnum.INBOX_MAILBOX_MANAGE) || !mailbox.organizationId)
			return false;
		const membership = await this.dataSource
			.createQueryBuilder()
			.select('uo.id', 'id')
			.from('user_organization', 'uo')
			.where('uo.tenantId = :tenantId', { tenantId: mailbox.tenantId })
			.andWhere('uo.organizationId = :organizationId', { organizationId: mailbox.organizationId })
			.andWhere('uo.userId = :userId', { userId })
			.andWhere('uo.isActive = :active', { active: true })
			.getRawOne<{ id: ID }>();
		return !!membership;
	}

	/**
	 * Of these users, those who are active members of the mailbox's organization now (all of them for a mailbox of the
	 * tenant itself), in the given order.
	 */
	private async current(mailbox: InboxMailbox, userIds: ID[]): Promise<ID[]> {
		if (userIds.length === 0 || !mailbox.organizationId) return userIds;
		const rows = await this.dataSource
			.createQueryBuilder()
			.select('uo.userId', 'userId')
			.from('user_organization', 'uo')
			.where('uo.tenantId = :tenantId', { tenantId: mailbox.tenantId })
			.andWhere('uo.organizationId = :organizationId', { organizationId: mailbox.organizationId })
			.andWhere('uo.userId IN (:...userIds)', { userIds })
			.andWhere('uo.isActive = :active', { active: true })
			.getRawMany<{ userId: ID | null }>();
		const active = new Set(rows.map((row) => row.userId));
		return userIds.filter((id) => active.has(id));
	}

	private async memberUserIds(mailbox: InboxMailbox): Promise<ID[]> {
		const rows = await this.dataSource
			.getRepository(InboxMailboxMember)
			.find({ where: { mailboxId: mailbox.id as ID, tenantId: mailbox.tenantId as ID, deletedAt: IsNull() } });
		return rows.map((row) => row.userId);
	}

	private async employeeUserId(tenantId: ID, employeeId: ID): Promise<ID | null> {
		const row = await this.dataSource
			.createQueryBuilder()
			.select('e.userId', 'userId')
			.from('employee', 'e')
			.where('e.id = :employeeId', { employeeId })
			.andWhere('e.tenantId = :tenantId', { tenantId })
			.getRawOne<{ userId: ID | null }>();
		return row?.userId ?? null;
	}

	private async teamUserIds(tenantId: ID, teamId: ID): Promise<ID[]> {
		const rows = await this.dataSource
			.createQueryBuilder()
			.select('e.userId', 'userId')
			.from('organization_team_employee', 'm')
			.innerJoin('employee', 'e', 'e.id = m.employeeId')
			.where('m.organizationTeamId = :teamId', { teamId })
			.andWhere('m.tenantId = :tenantId', { tenantId })
			.andWhere('m.deletedAt IS NULL')
			.getRawMany<{ userId: ID | null }>();
		return rows.map((row) => row.userId).filter((id): id is ID => !!id);
	}

	private async organizationManagerIds(tenantId: ID, organizationId: ID): Promise<ID[]> {
		const rows = await this.dataSource
			.createQueryBuilder()
			.select('uo.userId', 'userId')
			.from('user_organization', 'uo')
			.innerJoin('user', 'u', 'u.id = uo.userId')
			.innerJoin('role_permission', 'rp', 'rp.roleId = u.roleId')
			.where('uo.tenantId = :tenantId', { tenantId })
			.andWhere('uo.organizationId = :organizationId', { organizationId })
			.andWhere('uo.isActive = :active', { active: true })
			.andWhere('rp.permission = :permission', { permission: PermissionsEnum.INBOX_MAILBOX_MANAGE })
			.andWhere('rp.enabled = :enabled', { enabled: true })
			.getRawMany<{ userId: ID | null }>();
		return [...new Set(rows.map((row) => row.userId).filter((id): id is ID => !!id))];
	}
}
