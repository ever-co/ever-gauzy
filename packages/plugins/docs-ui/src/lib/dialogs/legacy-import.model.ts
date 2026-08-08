import { ID } from '@gauzy/contracts';

/**
 * Wire model of the legacy-import migration endpoints
 * (`packages/plugins/docs/src/lib/legacy-import/`, `09-consolidation-migration.md` §5).
 *
 * These interfaces mirror the backend's `legacy-import.types.ts` one-for-one. They are
 * duplicated rather than imported because `@gauzy/plugin-docs` is a **server** package
 * (TypeORM entities, NestJS providers): importing it from the UI bundle would pull the
 * whole backend graph into the browser chunk. `@gauzy/contracts` carries no migration
 * types, so the report shape lives here, next to its only consumer.
 *
 * 🛑 The label maps below hold FULL translation keys on purpose. A key built by string
 * concatenation — a `DOCS.MIGRATION.WARNINGS.*` prefix plus the wire code — resolves to an
 * object under the i18n guard in `lib/i18n/docs-i18n-keys.spec.ts` and would need a
 * dynamic-prefix exemption there; an explicit, exhaustive `Record` keyed by the wire value
 * keeps every key statically verifiable, and a new backend code becomes a compile error
 * instead of a raw key on screen.
 */

/** Legacy sources accepted by the migration endpoints (§5.1). */
export type LegacyImportSource = 'organization-document' | 'help-center';

/** Every selectable legacy source — the default selection (the endpoint defaults to both). */
export const LEGACY_IMPORT_SOURCES: readonly LegacyImportSource[] = ['organization-document', 'help-center'];

/** Closed warning-code set of the import report (§5.4). */
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

/** Record sources of the import report (§5.4) — finer-grained than the requested sources. */
export type LegacyImportRecordSource =
	| 'organization-document'
	| 'help-center'
	| 'help-center-article'
	| 'help-center-version';

/** One per-legacy-record entry of the import report (§5.4). */
export interface ILegacyImportRecord {
	source: LegacyImportRecordSource;
	/** The legacy row id (`'_container'` / `'_recovered'` for the system folders). */
	externalId: string;
	legacyName: string | null;
	action: LegacyImportAction;
	/** The created document id — `null` when skipped, failed, or on a dry run. */
	documentId: ID | null;
	parentDocumentId: ID | null;
	warnings: LegacyImportWarning[];
	error: { code: LegacyImportErrorCode; message: string } | null;
}

/** Per-source counters of the import report (§5.4). */
export interface ILegacyImportTotals {
	scanned: number;
	created: number;
	skipped: number;
	failed: number;
	warnings: number;
}

/** The four counter blocks of an import report, in the order the run processes them (§6). */
export type LegacyImportTotalsKey =
	| 'organizationDocuments'
	| 'helpCenterNodes'
	| 'helpCenterArticles'
	| 'helpCenterVersions';

/** The full import report — returned by both dry-run and real runs (§5.4). */
export interface ILegacyImportReport {
	reportId: string;
	dryRun: boolean;
	tenantId: ID;
	organizationId: ID;
	requestedByUserId: ID | null;
	sources: LegacyImportSource[];
	startedAt: string;
	finishedAt: string;
	totals: Record<LegacyImportTotalsKey, ILegacyImportTotals>;
	records: ILegacyImportRecord[];
}

/** One per-document entry of the rollback report (§8). */
export interface ILegacyRollbackRecord {
	source: string;
	externalId: string | null;
	legacyName: string | null;
	action: LegacyRollbackAction;
	documentId: ID;
	warnings: string[];
}

/** The rollback report (§8) — same envelope as the import report with rollback actions. */
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

/**
 * Body of `POST /migrations/import-legacy`.
 *
 * `dryRun` is **not** optional on the client: the endpoint defaults it to `true`
 * (`ImportLegacyDTO`), so an omitted flag silently downgrades a real run to a dry run —
 * exactly the failure mode a caller would never notice until nothing had been imported.
 */
export interface ILegacyImportInput {
	dryRun: boolean;
	sources: LegacyImportSource[];
}

/** Body of `POST /migrations/import-legacy/rollback` (§8). */
export interface ILegacyRollbackInput extends ILegacyImportInput {
	/** Bypasses the "edited since import" / "holds foreign children" rails. Never sent as `true` by the dialog. */
	force?: boolean;
}

/** `{ error: 'migration-in-progress' }` — the 409 body of a concurrent run (§5.2). */
export const LEGACY_MIGRATION_IN_PROGRESS = 'migration-in-progress';

/** Source checkbox labels (§10.4 names these two keys). */
export const LEGACY_IMPORT_SOURCE_LABEL_KEYS: Readonly<Record<LegacyImportSource, string>> = {
	'organization-document': 'DOCS.MIGRATION.SOURCE_ORGANIZATION_DOCUMENTS',
	'help-center': 'DOCS.MIGRATION.SOURCE_HELP_CENTER'
};

/** Totals table rows, in processing order (§6). */
export const LEGACY_IMPORT_TOTALS_ROWS: readonly { key: LegacyImportTotalsKey; labelKey: string }[] = [
	{ key: 'organizationDocuments', labelKey: 'DOCS.MIGRATION.REPORT.ORGANIZATION_DOCUMENTS' },
	{ key: 'helpCenterNodes', labelKey: 'DOCS.MIGRATION.REPORT.HELP_CENTER_NODES' },
	{ key: 'helpCenterArticles', labelKey: 'DOCS.MIGRATION.REPORT.HELP_CENTER_ARTICLES' },
	{ key: 'helpCenterVersions', labelKey: 'DOCS.MIGRATION.REPORT.HELP_CENTER_VERSIONS' }
];

/** Per-record source labels. */
export const LEGACY_RECORD_SOURCE_LABEL_KEYS: Readonly<Record<LegacyImportRecordSource, string>> = {
	'organization-document': 'DOCS.MIGRATION.REPORT.ORGANIZATION_DOCUMENTS',
	'help-center': 'DOCS.MIGRATION.REPORT.HELP_CENTER_NODES',
	'help-center-article': 'DOCS.MIGRATION.REPORT.HELP_CENTER_ARTICLES',
	'help-center-version': 'DOCS.MIGRATION.REPORT.HELP_CENTER_VERSIONS'
};

/** Per-record action labels. */
export const LEGACY_IMPORT_ACTION_LABEL_KEYS: Readonly<Record<LegacyImportAction, string>> = {
	created: 'DOCS.MIGRATION.ACTIONS.CREATED',
	'skipped-existing': 'DOCS.MIGRATION.ACTIONS.SKIPPED_EXISTING',
	'skipped-deleted': 'DOCS.MIGRATION.ACTIONS.SKIPPED_DELETED',
	failed: 'DOCS.MIGRATION.ACTIONS.FAILED'
};

/** Warning-code labels (§5.4 closed set). */
export const LEGACY_IMPORT_WARNING_LABEL_KEYS: Readonly<Record<LegacyImportWarning, string>> = {
	'duplicate-name-suffixed': 'DOCS.MIGRATION.WARNINGS.DUPLICATE_NAME_SUFFIXED',
	'empty-content': 'DOCS.MIGRATION.WARNINGS.EMPTY_CONTENT',
	'orphaned-category': 'DOCS.MIGRATION.WARNINGS.ORPHANED_CATEGORY',
	'mixed-flag-state': 'DOCS.MIGRATION.WARNINGS.MIXED_FLAG_STATE',
	'missing-file-asset': 'DOCS.MIGRATION.WARNINGS.MISSING_FILE_ASSET',
	'external-url-reference': 'DOCS.MIGRATION.WARNINGS.EXTERNAL_URL_REFERENCE',
	'html-conversion-degraded': 'DOCS.MIGRATION.WARNINGS.HTML_CONVERSION_DEGRADED',
	'unresolved-employee': 'DOCS.MIGRATION.WARNINGS.UNRESOLVED_EMPLOYEE',
	'mapped-private': 'DOCS.MIGRATION.WARNINGS.MAPPED_PRIVATE'
};

/** Error-code labels (§5.4 closed set). The record also carries a raw message. */
export const LEGACY_IMPORT_ERROR_LABEL_KEYS: Readonly<Record<LegacyImportErrorCode, string>> = {
	'db-write-failed': 'DOCS.MIGRATION.ERROR_CODES.DB_WRITE_FAILED',
	'parent-unresolved': 'DOCS.MIGRATION.ERROR_CODES.PARENT_UNRESOLVED',
	'binary-copy-failed': 'DOCS.MIGRATION.ERROR_CODES.BINARY_COPY_FAILED'
};

/** Rollback per-record action labels (§8). */
export const LEGACY_ROLLBACK_ACTION_LABEL_KEYS: Readonly<Record<LegacyRollbackAction, string>> = {
	deleted: 'DOCS.MIGRATION.ROLLBACK.ACTIONS.DELETED',
	'skipped-modified': 'DOCS.MIGRATION.ROLLBACK.ACTIONS.SKIPPED_MODIFIED',
	'skipped-has-children': 'DOCS.MIGRATION.ROLLBACK.ACTIONS.SKIPPED_HAS_CHILDREN'
};

/** Rollback totals rows (§8). */
export const LEGACY_ROLLBACK_TOTALS_ROWS: readonly {
	key: keyof ILegacyRollbackReport['totals'];
	labelKey: string;
}[] = [
	{ key: 'scanned', labelKey: 'DOCS.MIGRATION.ROLLBACK.REPORT.SCANNED' },
	{ key: 'deleted', labelKey: 'DOCS.MIGRATION.ROLLBACK.REPORT.DELETED' },
	{ key: 'skippedModified', labelKey: 'DOCS.MIGRATION.ROLLBACK.REPORT.SKIPPED_MODIFIED' },
	{ key: 'skippedHasChildren', labelKey: 'DOCS.MIGRATION.ROLLBACK.REPORT.SKIPPED_HAS_CHILDREN' }
];

/** An all-zero counter block — the identity for {@link sumImportTotals}. */
const EMPTY_TOTALS: ILegacyImportTotals = { scanned: 0, created: 0, skipped: 0, failed: 0, warnings: 0 };

/**
 * Adds the four per-source counter blocks of a report into one summary row.
 *
 * @param report The import report, or `null` before the first run.
 * @returns The combined counters (all zero when there is no report).
 */
export function sumImportTotals(report: ILegacyImportReport | null | undefined): ILegacyImportTotals {
	const blocks = Object.values(report?.totals ?? {}) as ILegacyImportTotals[];
	return blocks.reduce<ILegacyImportTotals>(
		(sum, totals) => ({
			scanned: sum.scanned + (totals?.scanned ?? 0),
			created: sum.created + (totals?.created ?? 0),
			skipped: sum.skipped + (totals?.skipped ?? 0),
			failed: sum.failed + (totals?.failed ?? 0),
			warnings: sum.warnings + (totals?.warnings ?? 0)
		}),
		{ ...EMPTY_TOTALS }
	);
}

/** Compares two source selections as sets — order and duplicates are irrelevant on the wire. */
function sameSources(left: readonly LegacyImportSource[], right: readonly LegacyImportSource[]): boolean {
	const a = new Set(left);
	const b = new Set(right);
	return a.size === b.size && [...a].every((source) => b.has(source));
}

/**
 * **The dry-run-before-a-real-run rule** (`09-consolidation-migration.md` §10.2 step 4→5).
 *
 * A real import may only be started when the report on screen is a DRY RUN of *exactly* the
 * sources that are about to be imported. Anything else means the user would be confirming a
 * number they never saw: a report from a previous real run (its `created` rows are already
 * in the hub), or a dry run of a different source selection (the counts belong to other data).
 *
 * Kept as a pure function rather than a template condition so the rule can be pinned by a
 * test and re-checked at the moment of the request, not only when the button was rendered.
 *
 * @param report The report currently on screen, if any.
 * @param sources The sources the user is about to import.
 * @returns Whether a real run may proceed.
 */
export function isDryRunSatisfied(
	report: ILegacyImportReport | null | undefined,
	sources: readonly LegacyImportSource[]
): boolean {
	if (!report || report.dryRun !== true) return false;
	if (!sources.length) return false;
	return sameSources(report.sources ?? [], sources);
}

/** Records the run could not import — the expandable error list of the report. */
export function failedRecords(report: ILegacyImportReport | null | undefined): ILegacyImportRecord[] {
	return (report?.records ?? []).filter((record) => record.action === 'failed' || !!record.error);
}

/** Warning code → number of records carrying it, most frequent first. */
export function warningCounts(
	report: ILegacyImportReport | null | undefined
): { code: LegacyImportWarning; count: number }[] {
	const counts = new Map<LegacyImportWarning, number>();
	for (const record of report?.records ?? []) {
		for (const warning of record.warnings ?? []) {
			counts.set(warning, (counts.get(warning) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([code, count]) => ({ code, count }))
		.sort((left, right) => right.count - left.count);
}
