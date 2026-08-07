import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
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
import { ImportLegacyDTO, RollbackLegacyDTO } from './dto';
import { ILegacyImportReport, ILegacyRollbackReport } from './legacy-import.types';
import { LegacyImportService } from './legacy-import.service';

/**
 * Admin-triggered consolidation of the two legacy features — **Organization Documents** and the
 * **Help Center** — into the Documents hub (09-consolidation-migration.md §5).
 *
 * Both endpoints are idempotent, dry-runnable, and strictly read-only towards the legacy tables:
 * they only ever create (or soft-delete) `Document` rows carrying a migration `externalSource`.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/migrations')
export class LegacyImportController {
	constructor(private readonly legacyImportService: LegacyImportService) {}

	/**
	 * Runs — or, by default, dry-runs — the legacy import for the caller's organization.
	 *
	 * A dry run performs the complete read + mapping + validation pass (duplicate-name
	 * resolution and parent resolution included) with zero writes and returns a report of
	 * identical shape. Re-running only ever imports legacy rows that have no migrated copy yet;
	 * archived and soft-deleted copies still count as existing, so nothing resurrects.
	 */
	@ApiOperation({ summary: 'Import (or dry-run) the legacy Organization Documents + Help Center data.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The per-record migration report.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A migration is already running for this organization.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@HttpCode(HttpStatus.OK)
	@Post('/import-legacy')
	public async importLegacy(@Body() input: ImportLegacyDTO): Promise<ILegacyImportReport> {
		return this.legacyImportService.importLegacy(input);
	}

	/**
	 * Undoes an import by **soft-deleting** the documents it created — identified purely by
	 * their migration `externalSource`. Nothing is physically deleted, file storage is never
	 * touched, and the legacy tables are untouched by construction.
	 *
	 * Default rails skip migrated documents users edited after the import and migrated folders
	 * holding non-migrated descendants; `force: true` bypasses them and promotes foreign
	 * descendants to the root instead of removing them.
	 *
	 * NOTE on permissions: `PermissionGuard` evaluates `@Permissions(...)` with OR semantics, so
	 * listing `DOCS_DELETE` here would *widen* access rather than narrow it. The gate therefore
	 * declares `DOCS_MANAGE` only and the service additionally asserts `DOCS_DELETE`, which is
	 * what §8 of the migration spec requires ("both required").
	 */
	@ApiOperation({ summary: 'Roll back a legacy import (soft-deletes the migrated documents only).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The per-record rollback report.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A migration is already running for this organization.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller lacks DOCS_DELETE.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@HttpCode(HttpStatus.OK)
	@Post('/import-legacy/rollback')
	public async rollbackLegacy(@Body() input: RollbackLegacyDTO): Promise<ILegacyRollbackReport> {
		return this.legacyImportService.rollbackLegacy(input);
	}
}
