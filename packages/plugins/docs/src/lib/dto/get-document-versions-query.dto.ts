import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Query params for `GET /documents/:id/versions`.
 *
 * The route used to type its query as the platform's `BaseQueryDTO`. Every DTO in that family
 * descends from `FindWhereQueryDTO`, whose `where` is `@IsNotEmpty()`, so with
 * `@UseValidationPipe(...)` the route answered EVERY call with
 * `400 {"message":["where should not be empty"]}` before the handler ran. The client has nothing to
 * filter on and correctly sends no query string, so version history was broken for every user, not
 * just for the e2e suite: the editor's panel caught the error and rendered `DOCS.ERRORS.PANEL_LOAD`
 * ("Couldn't load this document") with a Retry that could never succeed.
 *
 * Nothing ever read that `where`. `GetDocumentVersionsHandler` scopes off the document named in the
 * path, and `DocumentVersionService.getVersions()` builds its own `where` from that document,
 * consuming only `take`/`skip` from here.
 *
 * Pagination is kept with the same shape and bounds as the core `PaginationQueryDTO` — `whitelist:
 * true` strips unknown properties, so omitting these would silently discard a caller's paging. The
 * optional organization comes from a partial `TenantOrganizationBaseDTO`, matching
 * {@link DocumentScopeQueryDTO} on the sibling detail routes, which keeps the platform's
 * `@IsOrganizationBelongsToUser()` ownership check; when omitted the service falls back to the
 * request context.
 */
export class GetDocumentVersionsQueryDTO extends PartialType(TenantOrganizationBaseDTO) {
	/** Limit (paginated) — max number of snapshots to take. */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0, maximum: 100 })
	@IsOptional()
	@Min(0)
	@Max(100)
	@Transform((params: TransformFnParams) => Number.parseInt(params.value, 10))
	readonly take?: number;

	/** Offset (paginated) — where from snapshots should be taken. */
	@ApiPropertyOptional({ type: () => 'number', minimum: 0 })
	@IsOptional()
	@Min(0)
	@Transform((params: TransformFnParams) => Number.parseInt(params.value, 10))
	readonly skip?: number;
}
