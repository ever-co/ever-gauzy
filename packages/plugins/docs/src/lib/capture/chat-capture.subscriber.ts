import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { Subscription } from 'rxjs';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID
} from '@gauzy/contracts';
import { EventBus, FileStorage } from '@gauzy/core';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentProcessingService } from '../services/document-processing.service';
import { canonicalExtension, sniffFile } from '../services/file-sniffer';

/** The `@gauzy/plugin-ai-chat` surface this subscriber feature-detects at runtime. */
type AiChatPackage = typeof import('@gauzy/plugin-ai-chat');

/**
 * The event class name this subscriber binds to when the chat plugin exports it
 * (`07-ai-knowledge.md` §17.1). Kept as a string so a missing export is a *runtime*
 * feature-detection miss, not a compile error.
 */
export const AI_CHAT_ATTACHMENT_EVENT = 'AiChatAttachmentSavedEvent';

/**
 * The payload contract this plugin consumes (§17.1):
 * `{ tenantId, organizationId, userId, conversationId, file }`.
 */
export interface IAiChatAttachmentSavedPayload {
	tenantId: ID;
	organizationId: ID;
	userId?: ID;
	conversationId?: ID;
	file: {
		key?: string;
		originalname?: string;
		filename?: string;
		mimetype?: string;
		size?: number;
	};
}

/**
 * Chat capture (`07-ai-knowledge.md` §17.1).
 *
 * `@gauzy/plugin-ai-chat` is expected to publish `AiChatAttachmentSavedEvent` on the core
 * RxJS event bus when a user attaches a file to a conversation. This plugin subscribes and
 * turns that file into an ordinary `Document { kind: FILE, source: CHAT }` that then rides
 * the standard pipeline unchanged.
 *
 * **The chat plugin does not emit that event yet.** Adding attachment upload is its own M5
 * work item, and the event contract above is what this plugin consumes. Rather than ship a
 * dangling TODO, this subscriber **feature-detects the event class at runtime**:
 *
 * - the class IS exported ⇒ a live subscription is created and attachments are captured;
 * - the class is NOT exported (today) ⇒ a **registered no-op subscriber** stays in place,
 *   logs one debug line at bootstrap, and does nothing else. The seam is wired, so the day
 *   the chat plugin starts exporting + publishing the event, capture begins with **zero**
 *   changes on this side.
 *
 * Captured documents land as `source: CHAT`, `reviewStatus: PENDING` (`reason: manual`) and
 * `knowledgeStatus: NONE` — like every other capture channel, they are never auto-imported
 * into the AI knowledge base.
 */
@Injectable()
export class ChatCaptureSubscriber implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(ChatCaptureSubscriber.name);

	/** Live when the chat plugin exports the event class; undefined in the no-op case. */
	private subscription?: Subscription;

	constructor(
		private readonly eventBus: EventBus,
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly processingService: DocumentProcessingService
	) {}

	/** Whether a live subscription was established (as opposed to the no-op fallback). */
	public get isActive(): boolean {
		return !!this.subscription;
	}

	/**
	 * Feature-detects the chat attachment event and subscribes when it exists.
	 */
	onModuleInit(): void {
		const eventClass = this.resolveAttachmentEventClass();
		if (!eventClass) {
			this.logger.debug(
				`${AI_CHAT_ATTACHMENT_EVENT} is not exported by @gauzy/plugin-ai-chat — ` +
					'chat capture is registered as a no-op until the chat plugin emits it.'
			);
			return;
		}
		try {
			this.subscription = this.eventBus.ofType(eventClass).subscribe({
				next: (event: any) => void this.captureAttachment(event?.payload ?? event),
				error: (error: unknown) =>
					this.logger.warn(`Chat capture stream error: ${(error as Error)?.message}`)
			});
			this.logger.log(`Chat capture active — subscribed to ${AI_CHAT_ATTACHMENT_EVENT}.`);
		} catch (error) {
			this.logger.warn(`Failed to subscribe to ${AI_CHAT_ATTACHMENT_EVENT}: ${(error as Error).message}`);
		}
	}

	/** Drops the subscription on teardown (no-op when it was never established). */
	onModuleDestroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = undefined;
	}

	/**
	 * Turns one saved chat attachment into a `Document { kind: FILE, source: CHAT }`.
	 *
	 * Runs off the request path (event bus), so the tenant/organization scope comes from the
	 * event payload — `RequestContext` is never consulted.
	 *
	 * @param payload The attachment-saved payload.
	 */
	public async captureAttachment(payload: IAiChatAttachmentSavedPayload): Promise<Document | null> {
		if (!payload?.tenantId || !payload?.organizationId || !payload?.file?.key) {
			this.logger.debug('Chat attachment event ignored — incomplete payload.');
			return null;
		}
		const fileName = String(payload.file.originalname ?? payload.file.filename ?? 'attachment').slice(0, 255);

		try {
			const provider = new FileStorage().getProvider();
			const buffer = (await provider.getFile(payload.file.key)) as Buffer;

			// The same magic-byte gauntlet as the upload endpoint — a chat attachment is
			// user-supplied content and gets no discount.
			const sniff = sniffFile(buffer, fileName, payload.file.mimetype);
			if (!sniff.ok) {
				this.logger.warn(`Chat attachment '${fileName.slice(0, 40)}' rejected: ${sniff.code}`);
				return null;
			}

			const document = await this.typeOrmDocumentRepository.save(
				this.typeOrmDocumentRepository.create({
					tenantId: payload.tenantId,
					organizationId: payload.organizationId,
					kind: DocumentKindEnum.FILE,
					name: fileName,
					status: DocumentStatusEnum.UPLOADED,
					source: DocumentSourceEnum.CHAT,
					// Capture channels never auto-import into knowledge (§17).
					knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.MANUAL,
					visibility: DocumentVisibilityEnum.ORGANIZATION,
					storageProvider: provider.name.toUpperCase() as FileStorageProviderEnum,
					storageKey: payload.file.key,
					mimeType: sniff.type.mimeType,
					fileSize: payload.file.size ?? buffer.length,
					sha256: createHash('sha256').update(buffer).digest('hex'),
					originalFilename: fileName,
					version: 1,
					createdByUserId: payload.userId ?? null,
					metadata: {
						chatCapture: {
							conversationId: payload.conversationId ?? null,
							canonicalExtension: canonicalExtension(sniff.type.mimeType)
						}
					}
				} as Partial<Document>)
			);

			await this.processingService.enqueueExtract(document, 'upload');
			return document;
		} catch (error) {
			// Capture is best-effort: a failure must never break the chat turn that produced it.
			this.logger.error(`Chat attachment capture failed: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Runtime feature detection of the chat attachment event class.
	 *
	 * @returns The event constructor when the chat plugin exports it, else undefined.
	 */
	private resolveAttachmentEventClass(): any | undefined {
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const aiChat: Partial<AiChatPackage> & Record<string, any> = require('@gauzy/plugin-ai-chat');
			const candidate = aiChat?.[AI_CHAT_ATTACHMENT_EVENT];
			return typeof candidate === 'function' ? candidate : undefined;
		} catch (error) {
			this.logger.debug(`@gauzy/plugin-ai-chat could not be loaded: ${(error as Error).message}`);
			return undefined;
		}
	}
}
