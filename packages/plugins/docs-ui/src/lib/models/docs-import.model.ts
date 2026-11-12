import {
	DocumentImportItemStatusEnum,
	DocumentImportPhaseEnum,
	DocumentImportStatusEnum,
	DocumentKindEnum,
	IDocumentImport,
	IDocumentImportReportItem
} from '@gauzy/contracts';

/**
 * Pure helpers of the import dialog and the PDF download (`docs-import-export` spec FR-17): progress, the report split
 * by outcome, the translation keys of reasons, error codes and phases (static keys, so the i18n key guard sees each),
 * and the file name of a download.
 */

/** How often a running import is read again. */
export const DOCS_IMPORT_POLL_MS = 1500;

/** The translation key of each reason the server reports for a skipped or failed item. */
export const DOCS_IMPORT_REASON_KEYS: Readonly<Record<string, string>> = {
	ENCRYPTED: 'DOCS.IMPORT.REASON.ENCRYPTED',
	TOO_LARGE: 'DOCS.IMPORT.REASON.TOO_LARGE',
	UNSUPPORTED_TYPE: 'DOCS.IMPORT.REASON.UNSUPPORTED_TYPE',
	QUOTA_EXCEEDED: 'DOCS.IMPORT.REASON.QUOTA_EXCEEDED',
	PARENT_MISSING: 'DOCS.IMPORT.REASON.PARENT_MISSING',
	READ_FAILED: 'DOCS.IMPORT.REASON.READ_FAILED',
	CREATE_FAILED: 'DOCS.IMPORT.REASON.CREATE_FAILED',
	CONVERSION_FAILED: 'DOCS.IMPORT.REASON.CONVERSION_FAILED',
	PLAIN_TEXT: 'DOCS.IMPORT.REASON.PLAIN_TEXT'
};

/** The translation key of each error code an import can be refused or fail with. */
export const DOCS_IMPORT_ERROR_KEYS: Readonly<Record<string, string>> = {
	DOCS_IMPORT_FILE_REQUIRED: 'DOCS.IMPORT.ERROR.FILE_REQUIRED',
	DOCS_IMPORT_TOO_LARGE: 'DOCS.IMPORT.ERROR.TOO_LARGE',
	DOCS_IMPORT_NOT_A_ZIP: 'DOCS.IMPORT.ERROR.NOT_A_ZIP',
	DOCS_IMPORT_TOO_MANY_ENTRIES: 'DOCS.IMPORT.ERROR.TOO_MANY_ENTRIES',
	DOCS_IMPORT_UNSAFE_PATH: 'DOCS.IMPORT.ERROR.UNSAFE_PATH',
	DOCS_IMPORT_SYMLINK: 'DOCS.IMPORT.ERROR.SYMLINK',
	DOCS_IMPORT_ZIP_BOMB: 'DOCS.IMPORT.ERROR.ZIP_BOMB',
	DOCS_IMPORT_NO_PAGES: 'DOCS.IMPORT.ERROR.NO_PAGES',
	DOCS_IMPORT_STALLED: 'DOCS.IMPORT.ERROR.STALLED',
	DOCS_IMPORT_FAILED: 'DOCS.IMPORT.ERROR.FAILED'
};

/** The translation key of each phase of a running import. */
export const DOCS_IMPORT_PHASE_KEYS: Readonly<Record<string, string>> = {
	[DocumentImportPhaseEnum.PLANNING]: 'DOCS.IMPORT.PHASE.PLANNING',
	[DocumentImportPhaseEnum.TREE]: 'DOCS.IMPORT.PHASE.TREE',
	[DocumentImportPhaseEnum.CONTENT]: 'DOCS.IMPORT.PHASE.CONTENT',
	[DocumentImportPhaseEnum.DONE]: 'DOCS.IMPORT.PHASE.DONE'
};

/** The key of a reason (the generic one for a reason this client does not know). */
export const reasonKeyOf = (reason: string | null | undefined): string =>
	(reason && DOCS_IMPORT_REASON_KEYS[reason]) || 'DOCS.IMPORT.REASON.OTHER';

/** The key of an error code (the generic one for a code this client does not know, or none). */
export const errorKeyOf = (code: string | null | undefined): string =>
	(code && DOCS_IMPORT_ERROR_KEYS[code]) || 'DOCS.IMPORT.ERROR.FAILED';

/** The key of a phase (queued when there is none yet). */
export const phaseKeyOf = (phase: string | null | undefined): string => (phase && DOCS_IMPORT_PHASE_KEYS[phase]) || 'DOCS.IMPORT.PHASE.QUEUED';

/** Whether an import is over (completed or failed). */
export const isImportFinished = (value: Pick<IDocumentImport, 'status'> | null | undefined): boolean =>
	value?.status === DocumentImportStatusEnum.COMPLETED || value?.status === DocumentImportStatusEnum.FAILED;

/** The progress of an import, 0–100 (100 once it completed, whatever the counts say). */
export function importProgressPercent(value: Pick<IDocumentImport, 'status' | 'processedItems' | 'totalItems'> | null | undefined): number {
	if (!value) return 0;
	if (value.status === DocumentImportStatusEnum.COMPLETED) return 100;
	const total = Number(value.totalItems) || 0;
	if (total <= 0) return 0;
	return Math.max(0, Math.min(99, Math.floor(((Number(value.processedItems) || 0) / total) * 100)));
}

/** The report's items by outcome; the imported ones that can be opened (pages and folders) first among them. */
export function importReportGroups(value: Pick<IDocumentImport, 'report'> | null | undefined): {
	imported: IDocumentImportReportItem[];
	pages: IDocumentImportReportItem[];
	skipped: IDocumentImportReportItem[];
	failed: IDocumentImportReportItem[];
	unresolvedLinks: number;
} {
	const items = value?.report?.items ?? [];
	const imported = items.filter((item) => item.status === DocumentImportItemStatusEnum.IMPORTED);
	return {
		imported,
		pages: imported.filter((item) => item.kind === DocumentKindEnum.PAGE && !!item.documentId),
		skipped: items.filter((item) => item.status === DocumentImportItemStatusEnum.SKIPPED),
		failed: items.filter((item) => item.status === DocumentImportItemStatusEnum.FAILED),
		unresolvedLinks: items.reduce((total, item) => total + (Number(item.unresolvedLinks) || 0), 0)
	};
}

/** Whether a picked file looks like a zip (by name or type; the server checks the bytes). */
export function isZipFile(file: Pick<File, 'name' | 'type'> | null | undefined): boolean {
	if (!file) return false;
	return /\.zip$/i.test(file.name ?? '') || /^application\/(x-)?zip(-compressed)?$/i.test(file.type ?? '');
}

/**
 * The file name of a download from its `Content-Disposition` (the RFC 5987 `filename*` first, then `filename`), or the
 * fallback.
 */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string): string {
	const value = String(header ?? '');
	const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value);
	if (extended) {
		try {
			return decodeURIComponent(extended[1].trim()) || fallback;
		} catch {
			// a malformed escape: fall through to the plain name
		}
	}
	const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(value);
	const name = (plain?.[1] ?? plain?.[2] ?? '').trim();
	return name || fallback;
}

/** A byte count as the dialog shows a limit (`100 MB`). */
export function formatLimit(bytes: number | null | undefined): string {
	const value = Number(bytes) || 0;
	if (value >= 1024 * 1024 * 1024) return `${Math.round(value / (1024 * 1024 * 1024))} GB`;
	if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`;
	if (value >= 1024) return `${Math.round(value / 1024)} KB`;
	return `${value} B`;
}
