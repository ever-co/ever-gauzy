import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { ID } from '@gauzy/contracts';

/**
 * Soft deleting an organization (ever-co/ever-gauzy#11960).
 *
 * Marking the organization row alone left everything a person meets it through in place: its teams were still
 * listed at sign-in and in the workspace pick, its members' tokens still named it, and their next sign-in landed
 * them in it. A soft delete therefore marks, with the organization's own `deletedAt`, the rows of the organization
 * that sign-in, team lists and tokens read: team memberships, teams, organization memberships and member records.
 * Every read through either ORM leaves out a soft-deleted row, so the organization leaves every screen, and a token
 * that names it, or one of its member records, is refused by `JwtStrategy` at its next call.
 *
 * Nothing else is touched: projects, tasks, time logs and invoices stay as they are, and are out of reach because
 * no membership of the organization is left. A restore clears `deletedAt` on the rows that carry the organization's
 * exact value, so a row soft deleted on its own before (a team removed earlier) stays deleted.
 *
 * Tables are named by their table name: the data source resolves it to the entity, so the statements are the
 * ones the entity would get, and they run without the entity subscribers (nothing here changes what they react to).
 */

/** The code of the refusal to soft delete the last organization of a workspace. */
export const ORGANIZATION_LAST_OF_WORKSPACE = 'ORGANIZATION_LAST_OF_WORKSPACE';

/** The code of a delete for good the database refused, because other records still point at the organization. */
export const ORGANIZATION_DELETE_REFUSED = 'ORGANIZATION_DELETE_REFUSED';

/** What a caller is told when it soft deletes the last organization of its workspace. */
export const LAST_ORGANIZATION_MESSAGE =
	'The last organization of a workspace cannot be deleted. Create another organization first, then delete this one.';

/** What a caller is told when the database refuses to delete an organization for good. */
export const ORGANIZATION_DELETE_REFUSED_MESSAGE =
	'This organization cannot be deleted for good: other records still point to it or to its members. ' +
	'Delete it with DELETE /organization/:id/soft instead, which hides it and can be undone.';

/**
 * The tables whose rows of the organization a soft delete marks, each read by sign-in, team lists or tokens:
 * team memberships, teams, organization memberships, member records.
 */
export const TABLES_HIDDEN_WITH_ORGANIZATION = [
	'organization_team_employee',
	'organization_team',
	'user_organization',
	'employee'
] as const;

/** One table of {@link TABLES_HIDDEN_WITH_ORGANIZATION}. */
export type HiddenWithOrganization = (typeof TABLES_HIDDEN_WITH_ORGANIZATION)[number];

/** The organization a deletion or a restore applies to. */
export interface IOrganizationOfTenant {
	id: ID;
	tenantId: ID;
}

/** What a soft delete marked, and the members it moved. */
export interface IOrganizationHidden {
	/** Rows marked, per table. */
	rows: Record<HiddenWithOrganization, number>;
	/** Users whose last organization moved to another one of theirs, or to none. */
	lastOrganizationMoved: number;
	/** Users whose default organization moved to another one of theirs, or to none. */
	defaultOrganizationMoved: number;
	/** Users whose last team, a team of the organization, was cleared. */
	lastTeamCleared: number;
}

/** What a restore brought back. */
export interface IOrganizationRestored {
	/** Rows restored, per table. */
	rows: Record<HiddenWithOrganization, number>;
	/** Members left with no organization by the delete whose last organization is this one again. */
	lastOrganizationRestored: number;
}

/** How many identifiers one `IN (...)` list carries at most: far below every supported database's limit. */
const IN_LIST_SIZE = 500;

/**
 * Soft deletes an organization inside the caller's transaction: refuses the last organization of the workspace,
 * marks the organization and {@link TABLES_HIDDEN_WITH_ORGANIZATION} with `deletedAt`, then moves its members'
 * last and default organization to their first other active membership of the workspace (the oldest, the one a
 * sign-in falls back to), or to none, and clears a last team that is one of its teams.
 *
 * The workspace's live organizations are locked first on PostgreSQL and MySQL, so two deletions in the same
 * workspace run one after the other and cannot both pass the last-organization check. SQLite serializes writers
 * on its own.
 *
 * @param manager The transaction's entity manager.
 * @param organization The organization, already read in the caller's tenant.
 * @param deletedAt The instant written on every row: a restore finds the rows by it.
 * @returns What was marked and moved.
 * @throws NotFoundException when the organization is not a live organization of the tenant.
 * @throws ConflictException (`ORGANIZATION_LAST_OF_WORKSPACE`) when it is the workspace's last live organization.
 */
export async function hideOrganization(
	manager: EntityManager,
	organization: IOrganizationOfTenant,
	deletedAt: Date
): Promise<IOrganizationHidden> {
	const { id, tenantId } = organization;

	const liveOrganizationIds = await lockLiveOrganizations(manager, tenantId);
	if (!liveOrganizationIds.includes(id)) {
		throw new NotFoundException('The organization was not found.');
	}
	const otherOrganizationIds = liveOrganizationIds.filter((liveId) => liveId !== id);
	if (otherOrganizationIds.length === 0) {
		throw new ConflictException({ message: LAST_ORGANIZATION_MESSAGE, code: ORGANIZATION_LAST_OF_WORKSPACE });
	}

	// Read before the teams are marked: the reads below leave soft-deleted rows out.
	const teamIds = await liveTeamIds(manager, organization);

	const rows = {} as Record<HiddenWithOrganization, number>;
	for (const table of TABLES_HIDDEN_WITH_ORGANIZATION) {
		rows[table] = await setDeletedAt(
			manager,
			table,
			{ tenantId, organizationId: id, deletedAt: IsNull() },
			deletedAt
		);
	}
	await setDeletedAt(manager, 'organization', { tenantId, id, deletedAt: IsNull() }, deletedAt);

	const moved = await moveMembersOut(manager, organization, otherOrganizationIds);
	const lastTeamCleared = await clearLastTeam(manager, tenantId, teamIds);

	return { rows, ...moved, lastTeamCleared };
}

/**
 * Restores a soft-deleted organization inside the caller's transaction: clears `deletedAt` on the organization and
 * on the rows of {@link TABLES_HIDDEN_WITH_ORGANIZATION} that carry the organization's exact value, then points
 * the members left with no last organization back at it. A member moved to another organization stays there, and
 * can switch back.
 *
 * @param manager The transaction's entity manager.
 * @param organization The organization, already read in the caller's tenant (deleted rows included).
 * @returns What was restored; nothing when the organization is not soft deleted.
 * @throws NotFoundException when the organization is not one of the tenant.
 */
export async function restoreOrganization(
	manager: EntityManager,
	organization: IOrganizationOfTenant
): Promise<IOrganizationRestored> {
	const { id, tenantId } = organization;

	const query = manager
		.createQueryBuilder('organization', 'organization')
		.withDeleted()
		.select('organization.deletedAt', 'deletedAt')
		.where({ id, tenantId });
	if (supportsRowLocks(manager)) {
		query.setLock('pessimistic_write');
	}
	const stored: { deletedAt: Date | string | null } | undefined = await query.getRawOne();
	if (!stored) {
		throw new NotFoundException('The organization was not found.');
	}

	const rows = { organization_team_employee: 0, organization_team: 0, user_organization: 0, employee: 0 };
	if (stored.deletedAt === null || stored.deletedAt === undefined) {
		return { rows, lastOrganizationRestored: 0 };
	}

	// The value as the database returns it, so the comparison is the database's own: no conversion in between.
	const deletedAt = stored.deletedAt;
	await setDeletedAt(manager, 'organization', { tenantId, id }, null);
	for (const table of [...TABLES_HIDDEN_WITH_ORGANIZATION].reverse()) {
		rows[table] = await setDeletedAt(manager, table, { tenantId, organizationId: id, deletedAt }, null);
	}

	const lastOrganizationRestored = await pointMembersWithoutOrganizationBack(manager, organization);

	return { rows, lastOrganizationRestored };
}

/**
 * Whether the connection takes `SELECT ... FOR UPDATE`. TypeORM refuses it on SQLite, which serializes writers.
 *
 * @param manager The entity manager.
 * @returns True on PostgreSQL and MySQL.
 */
function supportsRowLocks(manager: EntityManager): boolean {
	const type = manager.connection.options.type;
	return type === 'postgres' || type === 'mysql' || type === 'mariadb';
}

/**
 * The live organizations of a workspace, locked for the rest of the transaction where the database locks rows.
 *
 * @param manager The transaction's entity manager.
 * @param tenantId The workspace.
 * @returns Their identifiers.
 */
async function lockLiveOrganizations(manager: EntityManager, tenantId: ID): Promise<ID[]> {
	const query = manager
		.createQueryBuilder('organization', 'organization')
		.select('organization.id', 'id')
		.where({ tenantId, deletedAt: IsNull() });
	if (supportsRowLocks(manager)) {
		query.setLock('pessimistic_write');
	}
	const organizations: { id: ID }[] = await query.getRawMany();
	return organizations.map((row) => row.id);
}

/**
 * The organization's teams not deleted yet.
 *
 * @param manager The transaction's entity manager.
 * @param organization The organization.
 * @returns Their identifiers.
 */
async function liveTeamIds(manager: EntityManager, { id, tenantId }: IOrganizationOfTenant): Promise<ID[]> {
	const teams: { id: ID }[] = await manager
		.createQueryBuilder('organization_team', 'team')
		.select('team.id', 'id')
		.where({ tenantId, organizationId: id, deletedAt: IsNull() })
		.getRawMany();
	return teams.map((row) => row.id);
}

/**
 * Writes `deletedAt` on the rows of a table that match a criteria.
 *
 * @param manager The transaction's entity manager.
 * @param table The table.
 * @param where The rows.
 * @param deletedAt The value: an instant to soft delete them, null to restore them.
 * @returns How many rows were written.
 */
async function setDeletedAt(
	manager: EntityManager,
	table: string,
	where: Record<string, unknown>,
	deletedAt: Date | null
): Promise<number> {
	const result = await manager
		.createQueryBuilder()
		.update(table)
		.set({ deletedAt })
		.where(where)
		.callListeners(false)
		.execute();
	return result.affected ?? 0;
}

/**
 * Splits a list into the lists one `IN (...)` carries.
 *
 * @param values The values.
 * @returns The chunks, in order.
 */
function chunks<T>(values: T[]): T[][] {
	const result: T[][] = [];
	for (let start = 0; start < values.length; start += IN_LIST_SIZE) {
		result.push(values.slice(start, start + IN_LIST_SIZE));
	}
	return result;
}

/**
 * Moves the last and the default organization of the users that point at a deleted organization to their first
 * other active membership of the workspace, oldest first (the one a sign-in falls back to), or to none.
 *
 * @param manager The transaction's entity manager.
 * @param organization The deleted organization.
 * @param otherOrganizationIds The workspace's other live organizations.
 * @returns How many users had each pointer moved.
 */
async function moveMembersOut(
	manager: EntityManager,
	{ id, tenantId }: IOrganizationOfTenant,
	otherOrganizationIds: ID[]
): Promise<Pick<IOrganizationHidden, 'lastOrganizationMoved' | 'defaultOrganizationMoved'>> {
	const users: { id: ID; lastOrganizationId: ID | null; defaultOrganizationId: ID | null }[] = await manager
		.createQueryBuilder('user', 'user')
		.select('user.id', 'id')
		.addSelect('user.lastOrganizationId', 'lastOrganizationId')
		.addSelect('user.defaultOrganizationId', 'defaultOrganizationId')
		.where([
			{ tenantId, lastOrganizationId: id },
			{ tenantId, defaultOrganizationId: id }
		])
		.getRawMany();
	if (users.length === 0) {
		return { lastOrganizationMoved: 0, defaultOrganizationMoved: 0 };
	}

	const nextOrganization = await firstOtherMemberships(
		manager,
		tenantId,
		users.map((user) => user.id),
		otherOrganizationIds
	);

	const lastOrganizationMoved = await movePointer(
		manager,
		{ id, tenantId },
		'lastOrganizationId',
		users.filter((user) => user.lastOrganizationId === id).map((user) => user.id),
		nextOrganization
	);
	const defaultOrganizationMoved = await movePointer(
		manager,
		{ id, tenantId },
		'defaultOrganizationId',
		users.filter((user) => user.defaultOrganizationId === id).map((user) => user.id),
		nextOrganization
	);

	return { lastOrganizationMoved, defaultOrganizationMoved };
}

/**
 * Each user's oldest active, non-archived membership among the given organizations.
 *
 * @param manager The transaction's entity manager.
 * @param tenantId The workspace.
 * @param userIds The users.
 * @param organizationIds The organizations a membership may be of.
 * @returns The organization per user; a user with none is absent.
 */
async function firstOtherMemberships(
	manager: EntityManager,
	tenantId: ID,
	userIds: ID[],
	organizationIds: ID[]
): Promise<Map<ID, ID>> {
	const memberships: { userId: ID; organizationId: ID; createdAt: Date | string }[] = [];
	for (const users of chunks(userIds)) {
		for (const organizations of chunks(organizationIds)) {
			const rows = await manager
				.createQueryBuilder('user_organization', 'membership')
				.select('membership.userId', 'userId')
				.addSelect('membership.organizationId', 'organizationId')
				.addSelect('membership.createdAt', 'createdAt')
				.where({
					tenantId,
					userId: In(users),
					organizationId: In(organizations),
					isActive: true,
					isArchived: false,
					deletedAt: IsNull()
				})
				.orderBy('membership.createdAt', 'ASC')
				.getRawMany();
			memberships.push(...rows);
		}
	}
	// Rows of one statement come oldest first; across statements they are merged by the same order (a stable sort).
	memberships.sort((left, right) => instantOf(left.createdAt) - instantOf(right.createdAt));

	const first = new Map<ID, ID>();
	for (const membership of memberships) {
		if (!first.has(membership.userId)) {
			first.set(membership.userId, membership.organizationId);
		}
	}
	return first;
}

/**
 * A creation date as the database returns it (a `Date`, or SQLite's text), as a number that orders like it.
 *
 * @param value The value read.
 * @returns Milliseconds; every value of one database is read the same way, so their order is kept.
 */
function instantOf(value: Date | string): number {
	if (value instanceof Date) {
		return value.getTime();
	}
	return Date.parse(String(value).replace(' ', 'T'));
}

/**
 * Moves one pointer (`lastOrganizationId` or `defaultOrganizationId`) of users from a deleted organization to the
 * organization given per user, or to none. Each statement also requires the pointer to still name the deleted
 * organization, so a change made meanwhile is kept.
 *
 * @param manager The transaction's entity manager.
 * @param organization The deleted organization.
 * @param column The pointer.
 * @param userIds The users whose pointer names the deleted organization.
 * @param nextOrganization The organization per user; a user absent from it gets none.
 * @returns How many users had the pointer moved.
 */
async function movePointer(
	manager: EntityManager,
	{ id, tenantId }: IOrganizationOfTenant,
	column: 'lastOrganizationId' | 'defaultOrganizationId',
	userIds: ID[],
	nextOrganization: Map<ID, ID>
): Promise<number> {
	const usersByTarget = new Map<ID | null, ID[]>();
	for (const userId of userIds) {
		const target = nextOrganization.get(userId) ?? null;
		usersByTarget.set(target, [...(usersByTarget.get(target) ?? []), userId]);
	}

	let moved = 0;
	for (const [target, users] of usersByTarget) {
		for (const chunk of chunks(users)) {
			const result = await manager
				.createQueryBuilder()
				.update('user')
				.set({ [column]: target })
				.where({ tenantId, id: In(chunk), [column]: id })
				.callListeners(false)
				.execute();
			moved += result.affected ?? 0;
		}
	}
	return moved;
}

/**
 * Clears the last team of the users whose last team is one of a deleted organization's teams: it would name a team
 * no read returns any more.
 *
 * @param manager The transaction's entity manager.
 * @param tenantId The workspace.
 * @param teamIds The deleted organization's teams.
 * @returns How many users had their last team cleared.
 */
async function clearLastTeam(manager: EntityManager, tenantId: ID, teamIds: ID[]): Promise<number> {
	let cleared = 0;
	for (const chunk of chunks(teamIds)) {
		const result = await manager
			.createQueryBuilder()
			.update('user')
			.set({ lastTeamId: null })
			.where({ tenantId, lastTeamId: In(chunk) })
			.callListeners(false)
			.execute();
		cleared += result.affected ?? 0;
	}
	return cleared;
}

/**
 * Points the active members of a restored organization that have no last organization (the delete left them with
 * none) back at it, so their next sign-in lands in it as before.
 *
 * @param manager The transaction's entity manager.
 * @param organization The restored organization.
 * @returns How many users were pointed back.
 */
async function pointMembersWithoutOrganizationBack(
	manager: EntityManager,
	{ id, tenantId }: IOrganizationOfTenant
): Promise<number> {
	const members: { userId: ID }[] = await manager
		.createQueryBuilder('user_organization', 'membership')
		.select('membership.userId', 'userId')
		.where({ tenantId, organizationId: id, isActive: true, isArchived: false, deletedAt: IsNull() })
		.getRawMany();

	let restored = 0;
	for (const chunk of chunks(members.map((member) => member.userId))) {
		const result = await manager
			.createQueryBuilder()
			.update('user')
			.set({ lastOrganizationId: id })
			.where({ tenantId, id: In(chunk), lastOrganizationId: IsNull() })
			.callListeners(false)
			.execute();
		restored += result.affected ?? 0;
	}
	return restored;
}
