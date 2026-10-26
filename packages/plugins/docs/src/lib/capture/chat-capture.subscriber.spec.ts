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
	// The real storage read helper (dependency-free), so the specs read what the providers really return.
	...jest.requireActual('@gauzy/core/src/lib/core/file-storage/helpers/stored-file-content'),
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

import { createHash } from 'crypto';
import { Readable } from 'stream';
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

	it('hashes the real bytes when the provider returns the SDK body stream (S3, Wasabi, DigitalOcean)', async () => {
		const bytes = Buffer.from('%PDF-1.4 attachment');
		mockProvider.getFile.mockResolvedValueOnce(
			Object.assign(Readable.from([bytes]), { transformToByteArray: async () => new Uint8Array(bytes) }) as any
		);
		const repository = { create: (row: any) => row, save: jest.fn(async (row: any) => ({ id: 'doc-2', ...row })) };
		const subscriber = new ChatCaptureSubscriber(
			{} as any,
			repository as any,
			{ enqueueExtract: jest.fn() } as any
		);

		const document = await subscriber.captureAttachment({
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			userId: 'user-1',
			file: { key: 'chat/b.pdf', originalname: 'b.pdf', mimetype: 'application/pdf' }
		} as any);

		expect(document).toMatchObject({
			sha256: createHash('sha256').update(bytes).digest('hex'),
			fileSize: bytes.length
		});
	});

	it('captures nothing and deletes nothing when the attachment cannot be read back', async () => {
		mockProvider.getFile.mockResolvedValueOnce(undefined as any);
		mockProvider.deleteFile.mockClear();
		const repository = { create: (row: any) => row, save: jest.fn() };
		const subscriber = new ChatCaptureSubscriber(
			{} as any,
			repository as any,
			{ enqueueExtract: jest.fn() } as any
		);
		jest.spyOn((subscriber as any).logger, 'error').mockImplementation(() => undefined);

		const document = await subscriber.captureAttachment({
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			userId: 'user-1',
			file: { key: 'chat/c.pdf', originalname: 'c.pdf', mimetype: 'application/pdf', size: 3 }
		} as any);

		expect(document).toBeNull();
		expect(repository.save).not.toHaveBeenCalled();
		expect(mockProvider.deleteFile).not.toHaveBeenCalled();
	});
});
