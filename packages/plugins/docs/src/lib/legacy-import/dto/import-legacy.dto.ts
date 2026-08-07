import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { LEGACY_IMPORT_SOURCES, LegacyImportSource } from '../legacy-import.types';

/**
 * Body of `POST /api/plugins/docs/migrations/import-legacy`
 * (09-consolidation-migration.md §5.1).
 *
 * NOTE on the `dryRun` default: the spec text writes `default: false`, this implementation
 * defaults it to **true** — the safe default for a destructive-looking admin endpoint. A real
 * run therefore always requires an explicit `{ "dryRun": false }`.
 */
export class ImportLegacyDTO extends TenantOrganizationBaseDTO {
	/** `true` (default) performs the full read + mapping + validation pass with zero writes. */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	readonly dryRun?: boolean;

	/** The legacy sources to scan. Omitted → both. */
	@ApiPropertyOptional({ enum: LEGACY_IMPORT_SOURCES, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(LEGACY_IMPORT_SOURCES.length)
	@IsIn(LEGACY_IMPORT_SOURCES, { each: true })
	readonly sources?: LegacyImportSource[];
}

/**
 * Body of `POST /api/plugins/docs/migrations/import-legacy/rollback` (§8).
 */
export class RollbackLegacyDTO extends ImportLegacyDTO {
	/**
	 * `true` soft-deletes migrated rows regardless of post-import edits and promotes
	 * non-migrated descendants of removed folders to the root (they are never deleted).
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly force?: boolean;
}
