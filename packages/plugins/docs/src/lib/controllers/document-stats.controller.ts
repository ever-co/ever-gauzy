import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe
} from '@gauzy/core';
import { GetDocumentsQueryDTO } from '../dto';
import { GetDocumentStatsQuery } from '../queries/get-document-stats.query';
import { IDocumentStats } from '../services/document-stats.service';

/**
 * `GET /plugins/docs/documents/stats` — org-global counts for the browse page's
 * stats tiles.
 *
 * 🛑 A separate controller on purpose: the static `/stats` segment must be
 * registered BEFORE `DocumentController`'s `/:id` routes or Nest resolves it into
 * `GET /documents/:id` (a UUID-pipe 400). Nest keeps declaration order across
 * controllers, so this controller precedes `DocumentController` in the barrel's
 * `Controllers` array — moving it after is a silent route shadowing.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentStatsController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Org-global document counts (status totals, needs-review, storage quota state).
	 * Filters beyond the mandatory `where` organization scope are ignored — tile
	 * numbers are stable while the user filters (the facets endpoint is the
	 * filter-relative one).
	 */
	@ApiOperation({ summary: 'Get org-global document stats for the hub tiles.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document stats retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/stats')
	public async getStats(@Query() params: GetDocumentsQueryDTO): Promise<IDocumentStats> {
		return this.queryBus.execute(new GetDocumentStatsQuery(params));
	}
}
