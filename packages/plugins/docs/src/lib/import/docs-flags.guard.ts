import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { getDocsConfig } from '../docs.config';
import { DOCS_IMPORT_DISABLED, DOCS_PDF_EXPORT_DISABLED } from '../docs.constants';

/**
 * 404 `DOCS_IMPORT_DISABLED` while `GAUZY_DOCS_IMPORT_ENABLED` is off — as a guard, so the answer comes before the
 * upload interceptor stores a byte of the zip.
 */
@Injectable()
export class DocsImportEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!getDocsConfig().importEnabled) {
			throw new NotFoundException({ message: 'Importing exported workspaces is not enabled on this installation', code: DOCS_IMPORT_DISABLED });
		}
		return true;
	}
}

/** 404 `DOCS_PDF_EXPORT_DISABLED` while `GAUZY_DOCS_PDF_EXPORT_ENABLED` is off. */
@Injectable()
export class DocsPdfExportEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!getDocsConfig().pdfExportEnabled) {
			throw new NotFoundException({ message: 'PDF export is not enabled on this installation', code: DOCS_PDF_EXPORT_DISABLED });
		}
		return true;
	}
}
