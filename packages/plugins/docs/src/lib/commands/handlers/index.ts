import { ArchiveDocumentHandler } from './archive-document.handler';
import { BulkDocumentActionHandler } from './bulk-document-action.handler';
import { CreateDocumentHandler } from './create-document.handler';
import { CreateDocumentCategoryHandler } from './create-document-category.handler';
import { CreateDocumentLinkHandler } from './create-document-link.handler';
import { DeleteDocumentHandler } from './delete-document.handler';
import { DeleteDocumentCategoryHandler } from './delete-document-category.handler';
import { DeleteDocumentLinkHandler } from './delete-document-link.handler';
import { DuplicateDocumentHandler } from './duplicate-document.handler';
import { MergeDocumentCategoryHandler } from './merge-document-category.handler';
import { MoveDocumentHandler } from './move-document.handler';
import { RecoverDocumentHandler } from './recover-document.handler';
import { ReorderDocumentsHandler } from './reorder-documents.handler';
import { ReplaceDocumentFileHandler } from './replace-document-file.handler';
import { ReprocessDocumentHandler } from './reprocess-document.handler';
import { RestoreDocumentVersionHandler } from './restore-document-version.handler';
import { UnarchiveDocumentHandler } from './unarchive-document.handler';
import { UpdateDocumentHandler } from './update-document.handler';
import { UpdateDocumentCategoryHandler } from './update-document-category.handler';
import { UpdateDocumentContentHandler } from './update-document-content.handler';
import { UpdateDocumentSettingsHandler } from './update-document-settings.handler';
import { UpdateExtractedTextHandler } from './update-extracted-text.handler';
import { UploadDocumentsHandler } from './upload-documents.handler';

export const CommandHandlers = [
	ArchiveDocumentHandler,
	BulkDocumentActionHandler,
	CreateDocumentHandler,
	CreateDocumentCategoryHandler,
	CreateDocumentLinkHandler,
	DeleteDocumentHandler,
	DeleteDocumentCategoryHandler,
	DeleteDocumentLinkHandler,
	DuplicateDocumentHandler,
	MergeDocumentCategoryHandler,
	MoveDocumentHandler,
	RecoverDocumentHandler,
	ReorderDocumentsHandler,
	ReplaceDocumentFileHandler,
	ReprocessDocumentHandler,
	RestoreDocumentVersionHandler,
	UnarchiveDocumentHandler,
	UpdateDocumentHandler,
	UpdateDocumentCategoryHandler,
	UpdateDocumentContentHandler,
	UpdateDocumentSettingsHandler,
	UpdateExtractedTextHandler,
	UploadDocumentsHandler
];
