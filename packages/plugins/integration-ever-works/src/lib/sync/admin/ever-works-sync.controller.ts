import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { EVER_WORKS_ROUTE_PREFIX } from '../../ever-works.constants';
import { EverWorksConflictsService } from '../conflicts/ever-works-conflicts.service';
import { EverWorksInitialSyncService } from '../initial/ever-works-initial-sync.service';
import { EverWorksSyncStatusService } from './ever-works-sync-status.service';

export class EverWorksResolveConflictDto {
	@ApiProperty({ enum: ['keep', 'use_other'], description: '`keep` accepts the merged value; `use_other` writes the value that lost into the Gauzy record.' })
	@IsIn(['keep', 'use_other'])
	readonly resolution!: 'keep' | 'use_other';
}

/**
 * `/api/integration/ever-works/mappings/:integrationTenantId/{sync,conflicts}` (plan 06 G-P1-10): the
 * dry run, initial sync and resync, the status, the sync log and the conflicts. Same guards and
 * organization-membership check as every management route; every response is `Cache-Control: no-store`.
 */
@ApiTags('Ever Works Integration')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/mappings/:integrationTenantId`)
export class EverWorksSyncController {
	constructor(
		private readonly status: EverWorksSyncStatusService,
		private readonly runs: EverWorksInitialSyncService,
		private readonly conflicts: EverWorksConflictsService
	) {}

	@Get('/sync/status')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Lag, queue counts, dead letters, open conflicts, the last error, link totals and the latest runs.' })
	getStatus(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.status.status(id, organizationId);
	}

	@Get('/sync/preview')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Dry run: per phase, the records on each side, the pairs, and what a sync would create. Writes nothing.' })
	preview(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.runs.preview(id, organizationId);
	}

	@Post('/sync/start')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Start the initial sync (records the feed head; the sync loop runs the phases).' })
	start(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.runs.start(id, 'initial', organizationId);
	}

	@Post('/sync/resync')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Resync: the same phases as a reconcile pass of every type (nothing at or below a link version is applied again).' })
	resync(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.runs.start(id, 'resync', organizationId);
	}

	@Post('/sync/cancel')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Stop the running sync (what it applied stays).' })
	cancel(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('organizationId') organizationId?: ID) {
		return this.runs.cancel(id, organizationId);
	}

	@Get('/sync/runs')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	listRuns(@Param('integrationTenantId', UUIDValidationPipe) id: ID, @Query('limit') limit?: string, @Query('organizationId') organizationId?: ID) {
		return this.runs.runs(id, Number.parseInt(limit ?? '10', 10) || 10, organizationId);
	}

	@Get('/sync/log')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The sync log, newest first (filters: status, direction, entityType; pages: limit, before).' })
	log(
		@Param('integrationTenantId', UUIDValidationPipe) id: ID,
		@Query('status') status?: string,
		@Query('direction') direction?: string,
		@Query('entityType') entityType?: string,
		@Query('limit') limit?: string,
		@Query('before') before?: string,
		@Query('organizationId') organizationId?: ID
	) {
		return this.status.log(id, { status, direction, entityType, limit, before }, organizationId);
	}

	@Get('/conflicts')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Conflicts (both values, the winner), newest first; state open (default), resolved or all.' })
	listConflicts(
		@Param('integrationTenantId', UUIDValidationPipe) id: ID,
		@Query('state') state?: string,
		@Query('limit') limit?: string,
		@Query('before') before?: string,
		@Query('organizationId') organizationId?: ID
	) {
		return this.conflicts.list(id, { state, limit, before }, organizationId);
	}

	@Post('/conflicts/:conflictId/resolve')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Resolve a conflict: keep the merged value, or use the other value (written into the Gauzy record and pushed).' })
	resolve(
		@Param('integrationTenantId', UUIDValidationPipe) id: ID,
		@Param('conflictId', UUIDValidationPipe) conflictId: ID,
		@Body() dto: EverWorksResolveConflictDto,
		@Query('organizationId') organizationId?: ID
	) {
		return this.conflicts.resolve(id, conflictId, dto.resolution, organizationId);
	}
}
