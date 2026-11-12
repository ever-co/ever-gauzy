import { DocumentImportItemStatusEnum, DocumentImportPhaseEnum, DocumentImportStatusEnum, DocumentKindEnum, IDocumentImport } from '@gauzy/contracts';
import * as en from '../../i18n/en.json';
import {
	DOCS_IMPORT_ERROR_KEYS,
	DOCS_IMPORT_PHASE_KEYS,
	DOCS_IMPORT_REASON_KEYS,
	errorKeyOf,
	fileNameFromDisposition,
	formatLimit,
	importProgressPercent,
	importReportGroups,
	isImportFinished,
	isZipFile,
	phaseKeyOf,
	reasonKeyOf
} from './docs-import.model';

/** The `DOCS.a.b` key's value in `en.json` (the namespace body). */
const translationOf = (key: string): unknown => key.replace(/^DOCS\./, '').split('.').reduce<any>((node, part) => node?.[part], en);

describe('docs-import.model', () => {
	it('has a translation for every reason, error and phase key', () => {
		for (const key of [...Object.values(DOCS_IMPORT_REASON_KEYS), ...Object.values(DOCS_IMPORT_ERROR_KEYS), ...Object.values(DOCS_IMPORT_PHASE_KEYS)]) {
			expect(typeof translationOf(key)).toBe('string');
		}
		expect(typeof translationOf('DOCS.IMPORT.REASON.OTHER')).toBe('string');
		expect(typeof translationOf('DOCS.IMPORT.PHASE.QUEUED')).toBe('string');
	});

	it('maps reasons, codes and phases to keys, with a generic one for the unknown', () => {
		expect(reasonKeyOf('QUOTA_EXCEEDED')).toBe('DOCS.IMPORT.REASON.QUOTA_EXCEEDED');
		expect(reasonKeyOf('SOMETHING_NEW')).toBe('DOCS.IMPORT.REASON.OTHER');
		expect(reasonKeyOf(undefined)).toBe('DOCS.IMPORT.REASON.OTHER');
		expect(errorKeyOf('DOCS_IMPORT_SYMLINK')).toBe('DOCS.IMPORT.ERROR.SYMLINK');
		expect(errorKeyOf(null)).toBe('DOCS.IMPORT.ERROR.FAILED');
		expect(phaseKeyOf(DocumentImportPhaseEnum.CONTENT)).toBe('DOCS.IMPORT.PHASE.CONTENT');
		expect(phaseKeyOf(null)).toBe('DOCS.IMPORT.PHASE.QUEUED');
	});

	it('reads the progress and whether an import is over', () => {
		expect(importProgressPercent({ status: DocumentImportStatusEnum.RUNNING, processedItems: 5, totalItems: 20 })).toBe(25);
		expect(importProgressPercent({ status: DocumentImportStatusEnum.RUNNING, processedItems: 20, totalItems: 20 })).toBe(99);
		expect(importProgressPercent({ status: DocumentImportStatusEnum.COMPLETED, processedItems: 0, totalItems: 0 })).toBe(100);
		expect(importProgressPercent({ status: DocumentImportStatusEnum.QUEUED, processedItems: 0, totalItems: 0 })).toBe(0);
		expect(importProgressPercent(null)).toBe(0);
		expect(isImportFinished({ status: DocumentImportStatusEnum.FAILED })).toBe(true);
		expect(isImportFinished({ status: DocumentImportStatusEnum.RUNNING })).toBe(false);
	});

	it('splits the report by outcome and counts the unresolved links', () => {
		const value = {
			report: {
				items: [
					{ path: 'V/Home.md', kind: DocumentKindEnum.PAGE, status: DocumentImportItemStatusEnum.IMPORTED, documentId: 'p1', unresolvedLinks: 2 },
					{ path: 'V', kind: DocumentKindEnum.FOLDER, status: DocumentImportItemStatusEnum.IMPORTED, documentId: 'f1' },
					{ path: 'V/a.exe', kind: DocumentKindEnum.FILE, status: DocumentImportItemStatusEnum.SKIPPED, reason: 'UNSUPPORTED_TYPE' },
					{ path: 'V/Big.md', kind: DocumentKindEnum.PAGE, status: DocumentImportItemStatusEnum.FAILED, documentId: 'p2', reason: 'TOO_LARGE', unresolvedLinks: 1 }
				]
			}
		} as Pick<IDocumentImport, 'report'>;
		const groups = importReportGroups(value);
		expect(groups.imported.map((item) => item.path)).toEqual(['V/Home.md', 'V']);
		expect(groups.pages.map((item) => item.documentId)).toEqual(['p1']);
		expect(groups.skipped).toHaveLength(1);
		expect(groups.failed).toHaveLength(1);
		expect(groups.unresolvedLinks).toBe(3);
		expect(importReportGroups(null)).toEqual({ imported: [], pages: [], skipped: [], failed: [], unresolvedLinks: 0 });
	});

	it('recognises a zip by name or type', () => {
		expect(isZipFile({ name: 'vault.ZIP', type: '' })).toBe(true);
		expect(isZipFile({ name: 'export', type: 'application/x-zip-compressed' })).toBe(true);
		expect(isZipFile({ name: 'notes.md', type: 'text/markdown' })).toBe(false);
		expect(isZipFile(null)).toBe(false);
	});

	it('reads the file name of a download', () => {
		expect(fileNameFromDisposition(`attachment; filename="road_map.pdf"; filename*=UTF-8''road%E2%80%94map.pdf`, 'x.pdf')).toBe('road—map.pdf');
		expect(fileNameFromDisposition('attachment; filename="plan.pdf"', 'x.pdf')).toBe('plan.pdf');
		expect(fileNameFromDisposition('attachment; filename=plain.zip', 'x.zip')).toBe('plain.zip');
		expect(fileNameFromDisposition(null, 'document.pdf')).toBe('document.pdf');
	});

	it('formats a limit', () => {
		expect(formatLimit(104857600)).toBe('100 MB');
		expect(formatLimit(1073741824)).toBe('1 GB');
		expect(formatLimit(2048)).toBe('2 KB');
		expect(formatLimit(0)).toBe('0 B');
	});
});
