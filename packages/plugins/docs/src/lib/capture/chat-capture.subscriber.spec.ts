/**
 * A file a user attached to their own chat conversation was captured as an ORGANIZATION document: listed, searchable
 * and downloadable (`/documents/:id/raw`) by every DOCS_READ holder of the organization, though the conversation it
 * was attached to is private to its user.
 */
const mockProvider = {
	name: 'local',
	getFile: jest.fn(async () => Buffer.from('%PDF-1.4 attachment')),
	deleteFile: jest.fn()
};
jest.mock('@gauzy/core', () => ({
	EventBus: class EventBus {},
	FileStorage: class FileStorage {
		getProvider() {
			return mockProvider;
		}
	}
}));
jest.mock('../entities/document.entity', () => ({ Document: class Document {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../services/file-sniffer', () => ({
	sniffFile: () => ({ ok: true, type: { mimeType: 'application/pdf' } }),
	canonicalExtension: () => 'pdf'
}));

import { DocumentSourceEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import { ChatCaptureSubscriber } from './chat-capture.subscriber';

describe('ChatCaptureSubscriber.captureAttachment', () => {
	it('captures the attachment as its user’s private document', async () => {
		const repository = { create: (row: any) => row, save: jest.fn(async (row: any) => ({ id: 'doc-1', ...row })) };
		const processing = { enqueueExtract: jest.fn() };
		const subscriber = new ChatCaptureSubscriber({} as any, repository as any, processing as any);

		const document = await subscriber.captureAttachment({
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			userId: 'user-1',
			conversationId: 'conversation-1',
			file: { key: 'chat/a.pdf', originalname: 'salary-review.pdf', mimetype: 'application/pdf', size: 19 }
		});

		expect(document).toMatchObject({
			source: DocumentSourceEnum.CHAT,
			visibility: DocumentVisibilityEnum.PRIVATE,
			createdByUserId: 'user-1'
		});
		expect(processing.enqueueExtract).toHaveBeenCalledTimes(1);
	});
});
