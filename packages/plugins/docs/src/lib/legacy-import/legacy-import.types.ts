import { ID } from '@gauzy/contracts';

/**
 * Legacy sources accepted by the migration endpoints (09-consolidation-migration.md §5.1).
 */
export type LegacyImportSource = 'organization-document' | 'help-center';

/** Every selectable legacy source (the default when `sources` is omitted). */
export const LEGACY_IMPORT_SOURCES: LegacyImportSource[] = ['organization-document', 'help-center'];

/** Provenance namespace written to `document.externalSource` for migrated org documents. */
export const LEGACY_SOURCE_ORG_DOCUMENT = 'organization-document';
/** Provenance namespace for migrated help-center tree nodes (bases + categories). */
export const LEGACY_SOURCE_HELP_CENTER = 'help-center';
/** Provenance namespace for migrated help-center articles. */
export const LEGACY_SOURCE_HELP_CENTER_ARTICLE = 'help-center-article';

/** Sentinel `externalId` of the "Organization Documents" container folder (§6.1). */
export const LEGACY_CONTAINER_EXTERNAL_ID = '_container';
/** Sentinel `externalId` of the lazily created "Help Center (recovered)" folder (§7 case 7). */
export const LEGACY_RECOVERED_EXTERNAL_ID = '_recovered';

/** Every provenance value the migration may stamp on `document.externalSource`. */
export const LEGACY_EXTERNAL_SOURCES = [
	LEGACY_SOURCE_ORG_DOCUMENT,
	LEGACY_SOURCE_HELP_CENTER,
	LEGACY_SOURCE_HELP_CENTER_ARTICLE
];

/**
 * Closed warning-code set of the import report (§5.4).
 */
export type LegacyImportWarning =
	| 'duplicate-name-suffixed'
	| 'empty-content'
	| 'orphaned-category'
	| 'mixed-flag-state'
	| 'missing-file-asset'
	| 'external-url-reference'
	| 'html-conversion-degraded'
	| 'unresolved-employee'
	| 'mapped-private';

/** Closed error-code set of the import report (§5.4). */
export type LegacyImportErrorCode = 'db-write-failed' | 'parent-unresolved' | 'binary-copy-failed';

/** Per-record actions of the import report (§5.4). */
export type LegacyImportAction = 'created' | 'skipped-existing' | 'skipped-deleted' | 'failed';

/** Per-record actions of the rollback report (§8). */
export type LegacyRollbackAction = 'deleted' | 'skipped-modified' | 'skipped-has-children';

/** Record sources of the import report (§5.4). */
export type LegacyImportRecordSource =
	| 'organization-document'
	| 'help-center'
	| 'help-center-article'
	| 'help-center-version';

/**
 * One per-legacy-record entry of the import report (§5.4).
 */
export interface ILegacyImportRecord {
	source: LegacyImportRecordSource;
	/** The legacy row id (`'_container'` / `'_recovered'` for the system folders). */
	externalId: string;
	legacyName: string | null;
	action: LegacyImportAction;
	/** The created `Document`/`DocumentVersion` id — `null` when skipped/failed or dryRun. */
	documentId: ID | null;
	parentDocumentId: ID | null;
	warnings: LegacyImportWarning[];
	error: { code: LegacyImportErrorCode; message: string } | null;
}

/**
 * Per-source counters of the import report (§5.4).
 */
export interface ILegacyImportTotals {
	scanned: number;
	created: number;
	skipped: number;
	failed: number;
	warnings: number;
}

/**
 * The full import report — returned by both dry-run and real runs (§5.4).
 */
export interface ILegacyImportReport {
	reportId: string;
	dryRun: boolean;
	tenantId: ID;
	organizationId: ID;
	requestedByUserId: ID | null;
	sources: LegacyImportSource[];
	startedAt: string;
	finishedAt: string;
	totals: {
		organizationDocuments: ILegacyImportTotals;
		helpCenterNodes: ILegacyImportTotals;
		helpCenterArticles: ILegacyImportTotals;
		helpCenterVersions: ILegacyImportTotals;
	};
	records: ILegacyImportRecord[];
}

/**
 * One per-document entry of the rollback report (§8).
 */
export interface ILegacyRollbackRecord {
	source: string;
	externalId: string | null;
	legacyName: string | null;
	action: LegacyRollbackAction;
	documentId: ID;
	warnings: string[];
}

/**
 * The rollback report (§8) — same envelope as the import report with rollback actions.
 */
export interface ILegacyRollbackReport {
	reportId: string;
	dryRun: boolean;
	force: boolean;
	tenantId: ID;
	organizationId: ID;
	requestedByUserId: ID | null;
	sources: LegacyImportSource[];
	startedAt: string;
	finishedAt: string;
	totals: {
		scanned: number;
		deleted: number;
		skippedModified: number;
		skippedHasChildren: number;
	};
	records: ILegacyRollbackRecord[];
}
