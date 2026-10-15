import { DocumentKindEnum, IDocument } from '@gauzy/contracts';
import { DOCS_PAGE_LINK } from '../../docs.constants';
import { DOCS_PAGE_FULL_VIEW } from '../page-editor/document-page-view';

/** Where `/pages/documents/file/:id` sends a document it does not show itself. */
export interface IDocumentViewRedirect {
	commands: string[];
	queryParams: Record<string, string>;
}

/**
 * `/pages/documents/file/:id` shows one document on its own, full width — how a sidebar favorite opens an
 * uploaded file (owner, 2026-10-15: "should display document full width, not display a list of documents").
 * A favorite whose kind was unknown when its link was built lands here too, so a PAGE goes on to the page
 * editor in its full view and a FOLDER to that folder in the hub; any other document is shown by this page.
 *
 * @param document The loaded document.
 * @returns The navigation to make instead, or null to show the document here.
 */
export function documentViewRedirect(document: Pick<IDocument, 'id' | 'kind'>): IDocumentViewRedirect | null {
	switch (document?.kind) {
		case DocumentKindEnum.PAGE:
			return { commands: [`${DOCS_PAGE_LINK}/page`, String(document.id)], queryParams: { view: DOCS_PAGE_FULL_VIEW } };
		case DocumentKindEnum.FOLDER:
			return { commands: [DOCS_PAGE_LINK], queryParams: { folder: String(document.id) } };
		default:
			return null;
	}
}

/**
 * What the preview of a document is built from. Background processing and the upload queue re-send an unchanged row
 * (`rowChanged`) on every poll, and a rename changes nothing the preview shows; rebuilding the preview — which
 * downloads the file again — only when this changes keeps the page still while it is being looked at.
 *
 * @param document The document shown.
 * @returns A value that differs whenever the preview would differ.
 */
export function previewSignature(document: Partial<IDocument> | null | undefined): string {
	if (!document) return '';
	const updatedAt = document.updatedAt ? new Date(document.updatedAt as Date | string).getTime() : '';
	return [updatedAt, document.status, document.mimeType, document.fileSize, document.version].join('|');
}
