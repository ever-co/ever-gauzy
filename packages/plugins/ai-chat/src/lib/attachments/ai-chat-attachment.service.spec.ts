// `@gauzy/core` pulls the whole bootstrap graph; only `RequestContext` is on the path under
// test, so it is stubbed AT THE MODULE BOUNDARY — hoisted above the imports.
const deleteFile = jest.fn(async () => undefined);
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentTenantId: jest.fn(() => 'tenant-1'),
		currentOrganizationId: jest.fn(() => 'org-1'),
		currentUserId: jest.fn(() => 'user-1'),
		currentRequest: jest.fn(() => ({ headers: {} }))
	},
	// The service discards a rejected upload through the active provider.
	FileStorage: jest.fn().mockImplementation(() => ({ getProvider: () => ({ deleteFile }) }))
}));

import { BadRequestException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { AiChatAttachmentSavedEvent } from './ai-chat-attachment.event';
import { AiChatAttachmentService } from './ai-chat-attachment.service';

/**
 * Chat attachment capture (`07-ai-knowledge.md` §17.1 / `10-implementation-plan.md` §7.1 P2).
 *
 * `@gauzy/plugin-docs` has shipped a `ChatCaptureSubscriber` that feature-detects
 * `AiChatAttachmentSavedEvent` on this package — and, because nothing here ever exported or
 * published it, that subscriber was a permanent no-op: every `onModuleInit` logged one debug line
 * and returned. These tests pin the two things that made it real.
 */
const requestContext = RequestContext as unknown as {
	currentTenantId: jest.Mock;
	currentOrganizationId: jest.Mock;
	currentUserId: jest.Mock;
	currentRequest: jest.Mock;
};

const uploaded = (overrides: Record<string, unknown> = {}) =>
	({
		key: 'ai-chat/tenant-1/org-1/abc.pdf',
		originalname: 'handbook.pdf',
		filename: 'abc.pdf',
		mimetype: 'application/pdf',
		size: 1024,
		...overrides
	}) as any;

describe('AiChatAttachmentService', () => {
	let publish: jest.Mock;
	let service: AiChatAttachmentService;

	beforeEach(() => {
		publish = jest.fn(async () => undefined);
		service = new AiChatAttachmentService({ publish } as any);
		requestContext.currentTenantId.mockReturnValue('tenant-1');
		requestContext.currentOrganizationId.mockReturnValue('org-1');
		requestContext.currentUserId.mockReturnValue('user-1');
		requestContext.currentRequest.mockReturnValue({ headers: {} });
	});

	it('publishes the event the Documents plugin subscribes to, with the full scope snapshot', async () => {
		await service.save(uploaded(), 'conversation-9');

		expect(publish).toHaveBeenCalledTimes(1);
		const event = publish.mock.calls[0][0];
		// `EventBus.ofType` filters on CONSTRUCTOR IDENTITY, so publishing a look-alike object
		// would be delivered to nobody — the class itself is the contract.
		expect(event).toBeInstanceOf(AiChatAttachmentSavedEvent);
		expect(event.payload).toEqual({
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			userId: 'user-1',
			conversationId: 'conversation-9',
			file: {
				key: 'ai-chat/tenant-1/org-1/abc.pdf',
				originalname: 'handbook.pdf',
				filename: 'abc.pdf',
				mimetype: 'application/pdf',
				size: 1024
			}
		});
	});

	it('returns the stored-object descriptor to the client', async () => {
		await expect(service.save(uploaded())).resolves.toEqual({
			key: 'ai-chat/tenant-1/org-1/abc.pdf',
			name: 'handbook.pdf',
			mimeType: 'application/pdf',
			size: 1024
		});
	});

	it('falls back to the `Organization-Id` header when the JWT carries no organization', async () => {
		requestContext.currentOrganizationId.mockReturnValue(null);
		requestContext.currentRequest.mockReturnValue({ headers: { 'organization-id': 'org-header' } });

		await service.save(uploaded());

		expect(publish.mock.calls[0][0].payload.organizationId).toBe('org-header');
	});

	/**
	 * Without a scope the consumer would have to GUESS which organization the file belongs to,
	 * which is how an attachment lands in the wrong workspace. Refusing is the only safe answer.
	 */
	it('refuses an attachment it cannot attribute to an organization — and removes the stored bytes', async () => {
		requestContext.currentOrganizationId.mockReturnValue(null);
		requestContext.currentRequest.mockReturnValue({ headers: {} });
		deleteFile.mockClear();

		await expect(service.save(uploaded())).rejects.toBeInstanceOf(BadRequestException);
		expect(publish).not.toHaveBeenCalled();
		// multer already wrote the object before the service ran: it must not be left orphaned.
		expect(deleteFile).toHaveBeenCalledWith('ai-chat/tenant-1/org-1/abc.pdf');
	});

	it('still rejects (with the scope error) when the orphan cleanup itself fails', async () => {
		requestContext.currentOrganizationId.mockReturnValue(null);
		requestContext.currentRequest.mockReturnValue({ headers: {} });
		deleteFile.mockRejectedValueOnce(new Error('disk gone'));

		await expect(service.save(uploaded())).rejects.toBeInstanceOf(BadRequestException);
	});

	/**
	 * On the default LOCAL provider Nest's plain @UploadedFile() hands over multer's diskStorage
	 * object, which has no `key` (only core's @UploadedFileStorage() maps it through the provider,
	 * which derives `key` from `path`). The controller now uses that decorator; this pins the
	 * contract the service relies on: a mapped file HAS a key and is accepted.
	 */
	it('accepts a provider-mapped LOCAL file (key derived from path)', async () => {
		const result = await service.save(
			uploaded({ path: '/srv/public/ai-chat/tenant-1/org-1/abc.pdf', key: 'ai-chat/tenant-1/org-1/abc.pdf' })
		);
		expect(result.key).toBe('ai-chat/tenant-1/org-1/abc.pdf');
	});

	it('rejects a request with no uploaded file', async () => {
		await expect(service.save(undefined as any)).rejects.toBeInstanceOf(BadRequestException);
	});

	/**
	 * The bytes ARE saved by the time this runs. A bus failure only means no capture channel
	 * heard about it, and reporting that to the user as a failed upload would be a lie.
	 */
	it('still reports success when the event bus rejects', async () => {
		publish.mockRejectedValue(new Error('bus down'));

		await expect(service.save(uploaded())).resolves.toMatchObject({ name: 'handbook.pdf' });
	});

	it('bounds an absurd client filename', async () => {
		const result = await service.save(uploaded({ originalname: 'x'.repeat(600) }));

		expect(result.name).toHaveLength(255);
	});
});
