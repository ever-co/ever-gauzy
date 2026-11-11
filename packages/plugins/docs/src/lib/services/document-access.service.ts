import { Injectable, Logger } from '@nestjs/common';
import { In, IsNull, WhereExpressionBuilder } from 'typeorm';
import { DocumentShareAccessEnum, DocumentVisibilityEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { Employee, OrganizationTeamEmployee, RequestContext, RolePermission, User } from '@gauzy/core';
import { TypeOrmDocumentShareRepository } from '../repositories/type-orm-document-share.repository';
import {
	IDocumentAccessRow,
	IDocumentAccessSubject,
	canAdministerShares,
	effectiveShareAccess,
	hasShareAtLeast,
	isDocumentReadable,
	isDocumentWritable
} from './document-access.predicate';
import { buildShareGrantExistsSql, buildTeamSpaceSql } from './document-access.sql';

/**
 * Resolves the requesting subject (user id, employee id, current team ids, permissions)
 * and answers share-overlay questions for the read/write paths.
 *
 * There are two evaluation surfaces and they are kept deliberately in lock-step:
 *
 * - **SQL** — `buildShareGrantExistsSql()` folded into `DocumentService.applyVisibilityScope()`
 *   and into the retrieval filter set, so lists/facets/tree/retrieval stay single-query;
 * - **In-memory** — the pure predicates of `document-access.predicate.ts`, used by the
 *   by-id paths (`findOneScoped`) and by the share-administration checks.
 *
 * Team membership is resolved at evaluation time on both surfaces — a removed team member
 * loses access on their next request, with no materialized copies to invalidate.
 */
@Injectable()
export class DocumentAccessService {
	private readonly logger = new Logger(DocumentAccessService.name);

	constructor(private readonly typeOrmDocumentShareRepository: TypeOrmDocumentShareRepository) {}

	/**
	 * The requesting user's employee in a page's organization.
	 *
	 * A user employed in several organizations carries one employee in the token (their last organization's); a
	 * follow, an automatic subscription, a mute or a review notification of a page belongs to the employee of the
	 * page's organization, which is the one that organization's fan-out and Inbox read. Falls back to the token's
	 * employee (see {@link currentEmployeeId}) when the user has no active employee there, or the scope is unknown.
	 * A lookup that fails throws: acting as another organization's employee is never the answer to a failed read.
	 *
	 * @param organizationId The page's organization.
	 * @param tenantId The page's tenant.
	 * @returns The employee id, or null.
	 */
	public async currentEmployeeIdIn(organizationId: ID | null | undefined, tenantId: ID | null | undefined): Promise<ID | null> {
		const fallback = this.currentEmployeeId();
		const userId = RequestContext.currentUserId();
		if (!userId || !organizationId || !tenantId) {
			return fallback;
		}
		return (await this.employeeIdOf(userId as ID, organizationId, tenantId)) ?? fallback;
	}

	/**
	 * A user's employee in one organization: the active, unarchived one, so a follow, a subscription or a mute is
	 * held by the employee the fan-out and the Inbox of that organization read. `null` when the user has none there;
	 * a failed read throws, so a caller can tell "no employee" from "not known".
	 *
	 * @param userId The user.
	 * @param organizationId The organization (a page's).
	 * @param tenantId The tenant.
	 */
	public async employeeIdOf(userId: ID, organizationId: ID, tenantId: ID): Promise<ID | null> {
		try {
			const employee = await this.typeOrmDocumentShareRepository.manager.findOne(Employee, {
				select: { id: true },
				where: { userId, organizationId, tenantId, isActive: true, isArchived: false }
			});
			return (employee?.id as ID) ?? null;
		} catch (error) {
			this.logger.warn(`The employee of user ${userId} in organization ${organizationId} was not read: ${(error as Error)?.message}`);
			throw error;
		}
	}

	/**
	 * Every employee of the requesting user in the tenant, whatever their state (inactive, archived or soft-deleted
	 * included): the identities a follow or a mute of theirs may have been saved under. Empty without a user; a failed
	 * read throws.
	 *
	 * @param tenantId The tenant.
	 */
	public async currentUserEmployeeIdsIn(tenantId: ID | null | undefined): Promise<ID[]> {
		const userId = RequestContext.currentUserId();
		if (!userId || !tenantId) return [];
		try {
			const employees = await this.typeOrmDocumentShareRepository.manager.find(Employee, {
				select: { id: true },
				where: { userId: userId as ID, tenantId },
				withDeleted: true
			});
			return employees.map((employee) => employee.id as ID).filter(Boolean);
		} catch (error) {
			this.logger.warn(`The employees of user ${userId} were not read: ${(error as Error)?.message}`);
			throw error;
		}
	}

	/**
	 * The employee id of the requesting user.
	 *
	 * `RequestContext.currentEmployeeId()` deliberately returns `null` for users holding
	 * `CHANGE_SELECTED_EMPLOYEE` (it means "the selected employee", not "me"), which would
	 * silently drop share grants for managers — so the identity is read off the JWT user.
	 *
	 * @returns The requesting user's employee id, or null.
	 */
	public currentEmployeeId(): ID | null {
		try {
			return (RequestContext.currentUser()?.employeeId as ID) ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Loads the team ids the requesting employee currently belongs to.
	 *
	 * @param employeeId The employee whose memberships to resolve.
	 * @returns The organization-team ids (empty when the subject has no employee record).
	 */
	public async currentTeamIds(employeeId?: ID | null): Promise<ID[]> {
		const id = employeeId ?? this.currentEmployeeId();
		if (!id) {
			return [];
		}
		try {
			const memberships = await this.typeOrmDocumentShareRepository.manager.find(OrganizationTeamEmployee, {
				select: { organizationTeamId: true },
				where: { employeeId: id, deletedAt: IsNull() }
			});
			return memberships.map((membership) => membership.organizationTeamId).filter(Boolean) as ID[];
		} catch (error) {
			// A membership lookup failure must never widen access — it degrades to "no team shares".
			this.logger.warn(`Team membership lookup failed for employee ${id}: ${(error as Error).message}`);
			return [];
		}
	}

	/**
	 * Builds the access subject of the current request: identity + the permissions the
	 * route guards have already proven.
	 *
	 * @returns The requesting subject (team ids resolved).
	 */
	public async currentSubject(): Promise<IDocumentAccessSubject> {
		const employeeId = this.currentEmployeeId();
		return {
			userId: RequestContext.currentUserId(),
			employeeId,
			teamIds: await this.currentTeamIds(employeeId),
			hasReadPermission: RequestContext.hasPermission(PermissionsEnum.DOCS_READ),
			hasManagePermission: RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE),
			hasUpdatePermission: RequestContext.hasPermission(PermissionsEnum.DOCS_UPDATE)
		};
	}

	/**
	 * Folds the share-grant `EXISTS` clause into a visibility bracket, when — and only
	 * when — the requesting subject has an employee identity to match shares against.
	 *
	 * @param web The `OR` bracket of the visibility scope.
	 * @param alias The document alias in the surrounding query.
	 * @returns True when the clause was added (i.e. the parameters were bound).
	 */
	public applyShareScope(web: WhereExpressionBuilder, alias: string): boolean {
		const employeeId = this.currentEmployeeId();
		const tenantId = RequestContext.currentTenantId();
		if (!employeeId || !tenantId) {
			return false;
		}
		web.orWhere(buildShareGrantExistsSql(alias), { shareEmployeeId: employeeId, shareTenantId: tenantId });
		return true;
	}

	/**
	 * Folds the team-space clause into a visibility bracket: the pages of the teams the requesting subject
	 * belongs to, when it has an employee identity to match memberships against.
	 *
	 * @param web The `OR` bracket of the visibility scope.
	 * @param alias The document alias in the surrounding query.
	 * @returns True when the clause was added (i.e. the parameters were bound).
	 */
	public applyTeamScope(web: WhereExpressionBuilder, alias: string): boolean {
		const employeeId = this.currentEmployeeId();
		if (!employeeId) {
			return false;
		}
		web.orWhere(buildTeamSpaceSql(alias), { teamEmployeeId: employeeId, teamVisibility: DocumentVisibilityEnum.TEAM });
		return true;
	}

	/**
	 * Loads the share rows of one document (used by the by-id access checks and by the
	 * share-administration endpoints).
	 *
	 * @param documentId The document whose overlay to load.
	 * @returns The share rows, or an empty array on any lookup failure.
	 */
	public async loadShares(documentId: ID): Promise<Array<{ employeeId?: ID; teamId?: ID; access: DocumentShareAccessEnum }>> {
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return [];
		}
		try {
			const shares = await this.typeOrmDocumentShareRepository.find({
				where: { documentId, tenantId }
			});
			return shares.map((share) => ({
				employeeId: share.employeeId,
				teamId: share.teamId,
				access: share.access
			}));
		} catch (error) {
			this.logger.warn(`Share lookup failed for document ${documentId}: ${(error as Error).message}`);
			return [];
		}
	}

	/**
	 * The employees among the given ids who are active in the document's organization, whose role holds the documents
	 * read permission, and who may read the page: for an ORGANIZATION page every one of them, for a PRIVATE or TEAM
	 * page the creator, the team's members and the share grantees — the pure predicate with the page's shares, each
	 * employee as the subject. What a review request or a share may name without telling someone of a page they
	 * cannot open. Three queries whatever the number of employees (memberships, roles, permissions).
	 *
	 * @param document The document projection with its id.
	 * @param employeeIds The employees named.
	 * @returns The ids kept, in the order given, each once.
	 */
	public async readersAmong(document: IDocumentAccessRow & { id: ID; tenantId: ID; organizationId?: ID | null }, employeeIds: readonly ID[]): Promise<ID[]> {
		const wanted = [...new Set(employeeIds.map(String))];
		if (!wanted.length) {
			return [];
		}
		const manager = this.typeOrmDocumentShareRepository.manager;
		const employees = await manager.find(Employee, {
			select: { id: true, userId: true },
			where: {
				id: In(wanted as ID[]),
				tenantId: document.tenantId,
				...(document.organizationId ? { organizationId: document.organizationId } : {}),
				isActive: true,
				isArchived: false
			}
		});
		if (!employees.length) {
			return [];
		}
		const byId = new Map(employees.map((employee) => [String(employee.id), employee]));
		const [teamIdsByEmployee, readers, shares] = await Promise.all([
			this.teamIdsByEmployee(employees.map((employee) => employee.id as ID)),
			this.usersHoldingRead(
				document.tenantId,
				employees.map((employee) => employee.userId).filter(Boolean) as ID[]
			),
			document.visibility === DocumentVisibilityEnum.ORGANIZATION ? Promise.resolve([]) : this.loadShares(document.id)
		]);
		const kept: ID[] = [];
		for (const id of wanted) {
			const employee = byId.get(id);
			if (!employee) {
				continue;
			}
			const readable = isDocumentReadable(
				{ ...document, shares },
				{
					userId: employee.userId ?? null,
					employeeId: employee.id as ID,
					teamIds: teamIdsByEmployee.get(String(employee.id)) ?? [],
					hasReadPermission: !!employee.userId && readers.has(String(employee.userId)),
					hasManagePermission: false
				}
			);
			if (readable) {
				kept.push(employee.id as ID);
			}
		}
		return kept;
	}

	/**
	 * The team ids of each of the given employees, in one query.
	 *
	 * @param employeeIds The employees whose memberships to resolve.
	 * @returns Employee id → organization-team ids (no entry for an employee of no team, or on a lookup failure).
	 */
	private async teamIdsByEmployee(employeeIds: ID[]): Promise<Map<string, ID[]>> {
		const byEmployee = new Map<string, ID[]>();
		if (!employeeIds.length) {
			return byEmployee;
		}
		try {
			const memberships = await this.typeOrmDocumentShareRepository.manager.find(OrganizationTeamEmployee, {
				select: { employeeId: true, organizationTeamId: true },
				where: { employeeId: In(employeeIds), deletedAt: IsNull() }
			});
			for (const membership of memberships) {
				if (!membership.employeeId || !membership.organizationTeamId) {
					continue;
				}
				const key = String(membership.employeeId);
				byEmployee.set(key, [...(byEmployee.get(key) ?? []), membership.organizationTeamId as ID]);
			}
		} catch (error) {
			// A membership lookup failure must never widen access — it degrades to "no team shares".
			this.logger.warn(`Team membership lookup failed for ${employeeIds.length} employees: ${(error as Error).message}`);
		}
		return byEmployee;
	}

	/**
	 * The users among the given ids whose role holds the documents read permission in the tenant: what the route
	 * guard proves of the requesting user, resolved for someone else (a reviewer named, a share grantee). Two queries
	 * (the users' roles, the roles' grants).
	 *
	 * @param tenantId The tenant the permission is held in.
	 * @param userIds The users to resolve.
	 * @returns The ids of the users who hold the permission (none on a lookup failure).
	 */
	private async usersHoldingRead(tenantId: ID, userIds: ID[]): Promise<Set<string>> {
		const holders = new Set<string>();
		if (!userIds.length) {
			return holders;
		}
		try {
			const manager = this.typeOrmDocumentShareRepository.manager;
			const users = await manager.find(User, {
				select: { id: true, roleId: true },
				where: { id: In(userIds), tenantId }
			});
			const roleIds = [...new Set(users.map((user) => user.roleId).filter(Boolean))] as ID[];
			if (!roleIds.length) {
				return holders;
			}
			const grants = await manager.find(RolePermission, {
				select: { roleId: true },
				where: {
					tenantId,
					roleId: In(roleIds),
					permission: PermissionsEnum.DOCS_READ,
					enabled: true,
					isActive: true,
					isArchived: false
				}
			});
			const readingRoles = new Set(grants.map((grant) => String(grant.roleId)));
			for (const user of users) {
				if (user.roleId && readingRoles.has(String(user.roleId))) {
					holders.add(String(user.id));
				}
			}
		} catch (error) {
			// A permission lookup failure must never widen the audience — it degrades to "nobody".
			this.logger.warn(`Read permission lookup failed for ${userIds.length} users: ${(error as Error).message}`);
		}
		return holders;
	}

	/**
	 * Whether the requesting subject may READ the given row, evaluating the full
	 * §3.4 truth table including the share overlay.
	 *
	 * @param document The document projection (`visibility`, `createdByUserId`, `id`).
	 * @param documentId The document id, when the row projection does not carry it.
	 * @returns True when the row is readable.
	 */
	public async canRead(document: IDocumentAccessRow, documentId: ID): Promise<boolean> {
		const subject = await this.currentSubject();
		// Cheap path first: ORGANIZATION / creator / admin never need the share lookup.
		if (isDocumentReadable({ ...document, shares: [] }, subject)) {
			return true;
		}
		if (!subject.employeeId) {
			return false;
		}
		const shares = await this.loadShares(documentId);
		return isDocumentReadable({ ...document, shares }, subject);
	}

	/**
	 * Whether the requesting subject may MUTATE the given row (§1.6 ownership + `EDIT`
	 * share overlay).
	 *
	 * @param document The document projection.
	 * @param documentId The document id.
	 * @returns True when the subject may mutate the row.
	 */
	public async canWrite(document: IDocumentAccessRow, documentId: ID): Promise<boolean> {
		const subject = await this.currentSubject();
		if (isDocumentWritable({ ...document, shares: [] }, subject)) {
			return true;
		}
		if (!subject.employeeId) {
			return false;
		}
		const shares = await this.loadShares(documentId);
		return isDocumentWritable({ ...document, shares }, subject);
	}

	/**
	 * Whether the requesting subject may administer the document's share overlay
	 * (creator or `DOCS_MANAGE` only — a grantee can never re-share).
	 *
	 * @param document The document projection.
	 * @returns True when share CRUD is permitted on the row.
	 */
	public async canAdministerShares(document: IDocumentAccessRow): Promise<boolean> {
		return canAdministerShares(document, await this.currentSubject());
	}

	/**
	 * The strongest share access the requesting subject holds on one document.
	 *
	 * @param document The document projection.
	 * @param documentId The document id.
	 * @returns The share access level, or null.
	 */
	public async effectiveShareAccess(
		document: IDocumentAccessRow,
		documentId: ID
	): Promise<DocumentShareAccessEnum | null> {
		const subject = await this.currentSubject();
		if (!subject.employeeId) {
			return null;
		}
		const shares = await this.loadShares(documentId);
		return effectiveShareAccess({ ...document, shares }, subject);
	}

	/**
	 * Whether the requesting subject holds at least the given share level on a document.
	 *
	 * @param document The document projection.
	 * @param documentId The document id.
	 * @param minimum The minimum share access required.
	 * @returns True when the overlay grants at least that level.
	 */
	public async hasShareAtLeast(
		document: IDocumentAccessRow,
		documentId: ID,
		minimum: DocumentShareAccessEnum
	): Promise<boolean> {
		const subject = await this.currentSubject();
		if (!subject.employeeId) {
			return false;
		}
		const shares = await this.loadShares(documentId);
		return hasShareAtLeast({ ...document, shares }, subject, minimum);
	}
}
