import { randomUUID } from 'crypto';
import { ID } from '@gauzy/contracts';

/**
 * The stored file behind one chat attachment.
 *
 * Field names mirror multer's uploaded-file shape (`originalname` / `filename` / `mimetype`)
 * because that is what the storage engine produces and what every consumer of this event was
 * already written against.
 */
export interface IAiChatAttachmentFile {
	/** Storage key of the stored object — the only durable handle to the bytes. */
	key: string;
	/** The client's filename. */
	originalname?: string;
	/** The stored object name. */
	filename?: string;
	/** The client-declared MIME. ADVISORY ONLY: consumers sniff the bytes themselves. */
	mimetype?: string;
	/** Stored size in bytes. */
	size?: number;
}

/**
 * Payload of {@link AiChatAttachmentSavedEvent} (spec `07-ai-knowledge.md` §17.1).
 *
 * The tenant/organization/user scope is carried EXPLICITLY rather than being read from
 * `RequestContext` by the consumer: the event is delivered on an RxJS bus, and a subscriber may
 * well handle it off the request thread, where there is no request context to read.
 */
export interface IAiChatAttachmentSavedPayload {
	tenantId: ID;
	organizationId: ID;
	/** The user who attached the file. */
	userId?: ID;
	/** The conversation the file was attached to, when the client sent one. */
	conversationId?: ID;
	file: IAiChatAttachmentFile;
}

/**
 * Published on the core event bus when a user attaches a file to a chat conversation.
 *
 * This is a PUBLISHED CONTRACT, not an internal detail: `@gauzy/plugin-docs` subscribes to it by
 * class (`capture/chat-capture.subscriber.ts`) and turns each attachment into an ordinary
 * `Document { kind: FILE, source: CHAT }` that then rides the standard extraction pipeline. That
 * subscriber feature-detects this export at runtime, so it stayed a permanent no-op for as long
 * as the chat plugin had no attachment feature to publish from.
 *
 * 🛑 The class NAME is part of the contract — the docs plugin resolves it by string
 * (`AI_CHAT_ATTACHMENT_EVENT`), and `EventBus.ofType` filters on constructor identity. Renaming
 * it silently stops chat capture with nothing failing anywhere.
 *
 * Structurally compatible with the core event bus's `BaseEvent` (`id` + `createdAt`) rather than
 * extending it — the base class is not part of the public `@gauzy/core` surface, which is the
 * same reason `DocsAiUsageEvent` is declared this way.
 */
export class AiChatAttachmentSavedEvent {
	/** Unique event id (BaseEvent shape). */
	public readonly id: ID = randomUUID();
	/** Emission timestamp (BaseEvent shape). */
	public readonly createdAt: Date = new Date();

	constructor(public readonly payload: IAiChatAttachmentSavedPayload) {}
}
