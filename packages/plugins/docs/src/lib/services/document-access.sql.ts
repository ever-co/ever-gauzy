import { prepareSQLQuery as p } from '@gauzy/core';

/**
 * The SQL mirror of the share overlay predicate (`document-access.predicate.ts`).
 *
 * Share grants are evaluated **inside the same SQL predicate as visibility** (§3.3) so
 * lists, facets, tree browsing, and retrieval all stay single-query and can never drift
 * apart from the pure predicate. Team membership resolves at query time through a
 * correlated sub-select on `organization_team_employee` — no materialized copies, so
 * removing someone from a team revokes their access on the next request.
 */

/** Named bind parameters the fragment expects on the query builder. */
export interface IShareScopeParameters {
	/** The requesting subject's employee id. */
	shareEmployeeId: string;
	/** The requesting subject's tenant id (share rows are tenant-scoped). */
	shareTenantId: string;
}

/**
 * Builds the `EXISTS (...)` fragment that is true when the requesting subject holds ANY
 * share (employee grant or a team they currently belong to) on the aliased document.
 *
 * Bind `shareEmployeeId` + `shareTenantId` alongside it — see `IShareScopeParameters`.
 *
 * @param documentAlias The document alias in the surrounding query (e.g. `document`, `doc`).
 * @returns The SQL fragment, dialect-prepared.
 */
export function buildShareGrantExistsSql(documentAlias: string): string {
	return p(
		`EXISTS (SELECT 1 FROM "document_share" "docShare" ` +
			`WHERE "docShare"."documentId" = "${documentAlias}"."id" ` +
			`AND "docShare"."tenantId" = :shareTenantId ` +
			`AND "docShare"."deletedAt" IS NULL ` +
			`AND ("docShare"."employeeId" = :shareEmployeeId ` +
			`OR "docShare"."teamId" IN (` +
			`SELECT "shareTeam"."organizationTeamId" FROM "organization_team_employee" "shareTeam" ` +
			`WHERE "shareTeam"."employeeId" = :shareEmployeeId AND "shareTeam"."deletedAt" IS NULL)))`
	);
}
