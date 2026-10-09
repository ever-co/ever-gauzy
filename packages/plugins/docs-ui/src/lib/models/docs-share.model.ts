import { DocumentShareAccessEnum, ID } from '@gauzy/contracts';

/**
 * Plugin-local wire models for the share overlay endpoints
 * (`03-backend-plugin.md` §4.12, semantics in `08-permissions-security.md` §3).
 *
 * ```
 * GET    /api/plugins/docs/documents/:id/shares            DOCS_READ
 * POST   /api/plugins/docs/documents/:id/shares            DOCS_UPDATE
 * PUT    /api/plugins/docs/documents/:id/shares/:shareId   DOCS_UPDATE
 * DELETE /api/plugins/docs/documents/:id/shares/:shareId   DOCS_UPDATE
 * ```
 *
 * The row entity itself (`IDocumentShare`) already lives in `@gauzy/contracts`;
 * only the create/update inputs are local until the backend wave lands DTOs.
 */

/** Which side of the `employeeId` XOR `teamId` invariant a new share targets. */
export type DocsShareTargetKind = 'employee' | 'team';

/**
 * `POST /documents/:id/shares` body. Exactly one of `employeeId` / `teamId` may
 * be present — both or neither is rejected with 400 `DOCS_SHARE_TARGET`.
 */
export interface IDocumentShareCreateInput {
	employeeId?: ID;
	teamId?: ID;
	access: DocumentShareAccessEnum;
	organizationId?: ID;
	tenantId?: ID;
}

/** `PUT /documents/:id/shares/:shareId` body — the access level is the only mutable field. */
export interface IDocumentShareUpdateInput {
	access: DocumentShareAccessEnum;
}

/**
 * Access levels in escalating order — rendered as a select and used to label the
 * "what this grants" hint. `EDIT` still requires the subject to hold
 * `DOCS_UPDATE`; a share never substitutes for a permission (§3.3 composition
 * invariant), which is why the dialog spells that out.
 */
export const DOCS_SHARE_ACCESS_LEVELS: DocumentShareAccessEnum[] = [
	DocumentShareAccessEnum.VIEW,
	DocumentShareAccessEnum.COMMENT,
	DocumentShareAccessEnum.EDIT
];

/** Backend `code` values the share endpoints can return (spec 03 §6). */
export const DOCS_SHARE_ERROR_CODES = {
	/** Both or neither of employee/team supplied. */
	TARGET: 'DOCS_SHARE_TARGET',
	/** The document is `ORGANIZATION`-visible — shares are meaningless there. */
	NOT_PRIVATE: 'DOCS_SHARE_NOT_PRIVATE'
} as const;
