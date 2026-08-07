import { GetDocumentHandler } from './get-document.handler';
import { GetDocumentCategoriesHandler } from './get-document-categories.handler';
import { GetDocumentCountHandler } from './get-document-count.handler';
import { GetDocumentFacetsHandler } from './get-document-facets.handler';
import { GetDocumentLinksHandler } from './get-document-links.handler';
import { GetDocumentSettingsHandler } from './get-document-settings.handler';
import { GetDocumentVersionHandler } from './get-document-version.handler';
import { GetDocumentVersionsHandler } from './get-document-versions.handler';
import { GetDocumentsHandler } from './get-documents.handler';

export const QueryHandlers = [
	GetDocumentHandler,
	GetDocumentCategoriesHandler,
	GetDocumentCountHandler,
	GetDocumentFacetsHandler,
	GetDocumentLinksHandler,
	GetDocumentSettingsHandler,
	GetDocumentVersionHandler,
	GetDocumentVersionsHandler,
	GetDocumentsHandler
];
