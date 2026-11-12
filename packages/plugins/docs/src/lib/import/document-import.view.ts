import { DocumentImportStatusEnum, IDocumentImport, IDocumentImportReport } from '@gauzy/contracts';
import { DOCS_IMPORT_MAX_RUNS, DOCS_IMPORT_STALE_MINUTES } from '../docs.constants';
import { IImportRow } from './document-import.types';

/** What to do with an import a reader or the startup sweep finds. */
export type ImportStaleAction = 'none' | 'resume' | 'fail';

/**
 * Whether an import has stalled (`docs-import-export` plan §5, resume): QUEUED or RUNNING without progress for
 * {@link DOCS_IMPORT_STALE_MINUTES} — its job was lost (a Redis flush, an inline run in a process that stopped). It
 * is resumed while it has runs left, and ends FAILED once it has had {@link DOCS_IMPORT_MAX_RUNS}.
 *
 * @param row The import.
 * @param now The time of the check.
 */
export function importStaleAction(row: Pick<IImportRow, 'status' | 'attempts' | 'lastProgressAt' | 'createdAt'>, now: Date = new Date()): ImportStaleAction {
	if (row.status !== DocumentImportStatusEnum.QUEUED && row.status !== DocumentImportStatusEnum.RUNNING) return 'none';
	const last = row.lastProgressAt ?? row.createdAt;
	const lastTime = last ? new Date(last).getTime() : NaN;
	if (!Number.isFinite(lastTime) || now.getTime() - lastTime < DOCS_IMPORT_STALE_MINUTES * 60_000) return 'none';
	return (row.attempts ?? 0) >= DOCS_IMPORT_MAX_RUNS ? 'fail' : 'resume';
}

/** The report of a row, parsed; null when there is none or it does not parse. */
export function reportOf(reportJson: string | null | undefined): IDocumentImportReport | null {
	if (!reportJson) return null;
	try {
		const parsed = JSON.parse(reportJson);
		return parsed && Array.isArray(parsed.items) ? (parsed as IDocumentImportReport) : null;
	} catch {
		return null;
	}
}

/**
 * The import as the API answers it: the state, progress, counts and report — never the storage key of the zip nor
 * the request-thread options (the quota of the organization is not the reader's business).
 *
 * @param row The `document_import` row.
 * @param withReport Whether to include the report (the list leaves it out).
 */
export function toImportView(row: IImportRow & { createdAt?: Date; updatedAt?: Date }, withReport = true): IDocumentImport {
	return {
		id: row.id,
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		status: row.status,
		phase: row.phase ?? null,
		layout: row.layout ?? null,
		fileName: row.fileName,
		fileSize: row.fileSize ?? null,
		parentId: row.parentId ?? null,
		visibility: row.visibility ?? null,
		organizationTeamId: row.organizationTeamId ?? null,
		totalItems: Number(row.totalItems) || 0,
		processedItems: Number(row.processedItems) || 0,
		importedCount: Number(row.importedCount) || 0,
		skippedCount: Number(row.skippedCount) || 0,
		failedCount: Number(row.failedCount) || 0,
		attempts: Number(row.attempts) || 0,
		errorCode: row.errorCode ?? null,
		errorMessage: row.errorMessage ?? null,
		report: withReport ? reportOf(row.reportJson) : null,
		startedAt: row.startedAt ?? null,
		finishedAt: row.finishedAt ?? null,
		lastProgressAt: row.lastProgressAt ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	} as IDocumentImport;
}
