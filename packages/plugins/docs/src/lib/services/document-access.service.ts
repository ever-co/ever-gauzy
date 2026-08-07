import { Injectable, Logger } from '@nestjs/common';
import { IsNull, WhereExpressionBuilder } from 'typeorm';
import { DocumentShareAccessEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { OrganizationTeamEmployee, RequestContext } from '@gauzy/core';
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
import { buildShareGrantExistsSql } from './document-access.sql';

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
