import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ID, UploadedFile } from '@gauzy/contracts';
import { EventBus, FileStorage, RequestContext } from '@gauzy/core';
import { AiChatAttachmentSavedEvent } from './ai-chat-attachment.event';

/**
 * Largest chat attachment accepted.
 *
 * Exported so the route can declare the SAME cap as a multer `limits` — one constant, two
 * enforcement points that cannot drift, exactly as `MAX_AUDIO_BYTES` does for dictation.
 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** What the client gets back for one saved attachment. */
export interface IAiChatAttachmentResult {
	/** Storage key of the stored object. */
	key: string;
	/** The client's filename, as stored. */
	name: string;
	/** The client-declared MIME (advisory — consumers sniff the bytes). */
	mimeType?: string;
	/** Stored size in bytes. */
	size?: number;
}

/**
 * AiChatAttachmentService
 *
 * Saves a file a user attached to a chat conversation and announces it on the core event bus as
 * {@link AiChatAttachmentSavedEvent}.
 *
 * The bytes have already been streamed into the configured `FileStorage` provider by the route's
 * interceptor, so this service never touches file content — its whole job is to snapshot the
 * requesting scope while `RequestContext` is still live and publish the event.
 *
 * What happens NEXT is deliberately not this plugin's business: `@gauzy/plugin-docs` subscribes
 * to the event and turns the attachment into a `Document { kind: FILE, source: CHAT }` that rides
 * the standard extraction pipeline, after which the chat's own `docs_search` / `docs_read` tools
 * can read it. On an install without the docs plugin the event simply has no subscriber and the
 * file stays in storage.
 */
@Injectable()
export class AiChatAttachmentService {
	private readonly logger = new Logger(AiChatAttachmentService.name);

	constructor(private readonly eventBus: EventBus) {}

	/**
	 * Records one saved attachment.
	 *
	 * @param file The uploaded file, already stored by the route's storage engine.
	 * @param conversationId The conversation it was attached to, when the client sent one.
	 * @returns The stored-object descriptor for the client.
	 */
	async save(file: UploadedFile, conversationId?: string): Promise<IAiChatAttachmentResult> {
		if (!file?.key) {
			throw new BadRequestException('No file was uploaded.');
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.resolveOrganizationId();
		if (!tenantId || !organizationId) {
			// Without a scope the attachment cannot be attributed to anything, and a consumer
			// would have to guess — which is how a file ends up in the wrong organization. The bytes
			// are already in storage (multer ran first): remove them rather than leave an orphan.
			await this.discardStoredFile(file.key);
			throw new BadRequestException(
				'An organization is required to attach a file — send the `Organization-Id` header.'
			);
		}

		const name = String(file.originalname ?? file.filename ?? 'attachment').slice(0, 255);
		const event = new AiChatAttachmentSavedEvent({
			tenantId,
			organizationId,
			userId: RequestContext.currentUserId() ?? undefined,
			...(conversationId ? { conversationId: conversationId as ID } : {}),
			file: {
				key: file.key,
				originalname: name,
				filename: file.filename,
				mimetype: file.mimetype,
				size: file.size
			}
		});

		try {
			await this.eventBus.publish(event as any);
		} catch (error) {
			// The file IS saved either way; a bus failure must not read to the user as a failed
			// upload. It only means no capture channel heard about it.
			this.logger.warn(
				`AiChatAttachmentSavedEvent publish failed: ${error instanceof Error ? error.message : error}`
			);
		}

		return {
			key: file.key,
			name,
			...(file.mimetype ? { mimeType: file.mimetype } : {}),
			...(file.size !== undefined ? { size: file.size } : {})
		};
	}

	/**
	 * Removes a stored object that will not be recorded (rejected upload). Best effort: a failure
	 * to delete must not mask the rejection the caller is about to see.
	 *
	 * @param key The storage key of the object.
	 */
	private async discardStoredFile(key: string): Promise<void> {
		try {
			await new FileStorage().getProvider().deleteFile(key);
		} catch (error) {
			this.logger.warn(
				`Could not remove rejected attachment '${key}': ${error instanceof Error ? error.message : error}`
			);
		}
	}

	/**
	 * The requesting organization: the request context first, then the `Organization-Id` header
	 * the web client sends on every call (the JWT itself carries no organization).
	 */
	private resolveOrganizationId(): ID | undefined {
		const fromContext = RequestContext.currentOrganizationId();
		if (fromContext) {
			return fromContext;
		}
		const header = RequestContext.currentRequest()?.headers?.['organization-id'];
		const value = Array.isArray(header) ? header[0] : header;
		return value ? (String(value) as ID) : undefined;
	}
}
