import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional, PayloadTooLargeException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Like } from 'typeorm';
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
import { FileStorage, TenantSetting } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_INBOUND_DISABLED,
	DOCS_INBOUND_NO_ATTACHMENTS,
	DOCS_INBOUND_SIGNATURE_INVALID,
	DOCS_INBOUND_TOO_LARGE,
	DOCS_INBOUND_UNKNOWN_RECIPIENT,
	DOCS_SETTING_INBOUND_TOKEN,
	DOCS_SETTING_PREFIX
} from '../docs.constants';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { canonicalExtension, sniffFile } from '../services/file-sniffer';
import { DocumentProcessingService } from '../services/document-processing.service';
import {
	DOCS_INBOUND_EMAIL_ADAPTER,
	IInboundEmailAdapter,
	IInboundEmailAttachment,
	IInboundWebhookRequest,
	ParsedInboundEmail
} from './inbound-email.types';

/** The per-attachment result reported back to the provider. */
export interface IInboundEmailImportResult {
	fileName: string;
	documentId?: ID;
	accepted: boolean;
	code?: string;
}

/** The webhook response envelope. */
export interface IInboundEmailResponse {
	adapter: string;
	organizationId?: ID;
	accepted: number;
	rejected: number;
	results: IInboundEmailImportResult[];
}

/**
 * Inbound-email capture (`07-ai-knowledge.md` §17.2).
 *
 * The whole channel is **off unless `GAUZY_DOCS_INBOUND_EMAIL_ENABLED=true`** — a disabled
 * deployment answers 404 (the route does not exist as far as the world can tell), so
 * enabling it is a deliberate act.
 *
 * Mandatory gates, in order (every one of them fails closed):
 *
 * 1. **Feature switch** — env off ⇒ 404.
 * 2. **Signature** — the bound adapter verifies the provider signature ⇒ 403 otherwise.
 * 3. **Recipient token match** — the capture address is `docs-<token>@<domain>`; the token
 *    must equal the org setting `docs.<organizationId>.inboundToken`. No match ⇒ 404
 *    (an unknown token must not reveal which organizations exist).
 * 4. **SPF/DKIM** — when the provider reports verdicts, both must pass.
 * 5. **Size caps** — per message (`GAUZY_DOCS_INBOUND_MAX_MESSAGE_BYTES`) and per attachment
 *    (`GAUZY_DOCS_MAX_FILE_SIZE`).
 * 6. **Attachments only** — the body is discarded; a message with no attachment is rejected.
 * 7. **Content sniffing** — the same magic-byte gauntlet the upload endpoint runs.
 *
 * Resulting documents land as `source: EMAIL`, `reviewStatus: PENDING`
 * (`reviewReason: manual`) and `knowledgeStatus: NONE` — **never auto-imported to the AI
 * knowledge base**. A human approves them in the review queue first.
 *
 * There is no `RequestContext` on a webhook thread, so every write carries the explicit
 * tenant/organization snapshot resolved from the capture token.
 */
@Injectable()
export class InboundEmailService {
	private readonly logger = new Logger(InboundEmailService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly processingService: DocumentProcessingService,
		/** The provider adapter; the generic signed-webhook reference adapter is the default binding. */
		@Optional()
		@Inject(DOCS_INBOUND_EMAIL_ADAPTER)
		private readonly adapter?: IInboundEmailAdapter
	) {}

	/**
	 * Handles one inbound webhook delivery end to end.
	 *
	 * @param request The transport-neutral webhook request.
	 * @returns The per-attachment result envelope.
	 */
	async handleWebhook(request: IInboundWebhookRequest): Promise<IInboundEmailResponse> {
		const config = getDocsConfig();

		// Gate 1 — the channel is off unless explicitly enabled.
		if (!config.inboundEmailEnabled) {
			throw new NotFoundException({
				message: 'The inbound-email capture channel is not enabled',
				code: DOCS_INBOUND_DISABLED
			});
		}
		if (!this.adapter) {
			throw new NotFoundException({
				message: 'No inbound-email adapter is bound',
				code: DOCS_INBOUND_DISABLED
			});
		}

		// Gate 2 — signature.
		if (!this.adapter.verifySignature(request)) {
			throw new ForbiddenException({
				message: 'Invalid inbound-email webhook signature',
				code: DOCS_INBOUND_SIGNATURE_INVALID
			});
		}

		const message = await this.adapter.parse(request);

		// Gate 3 — per-org recipient token match.
		const token = this.extractCaptureToken(message.recipient);
		const scope = token ? await this.resolveScopeByToken(token) : null;
		if (!scope) {
			// Deliberately identical to "no such route" — an unknown token reveals nothing.
			throw new NotFoundException({
				message: 'Unknown capture address',
				code: DOCS_INBOUND_UNKNOWN_RECIPIENT
			});
		}

		// Gate 4 — authentication verdicts, when the provider reports them.
		if (message.spfPass === false || message.dkimPass === false) {
			throw new ForbiddenException({
				message: 'The message failed SPF/DKIM verification',
				code: DOCS_INBOUND_SIGNATURE_INVALID
			});
		}

		// Gate 5 — per-message size cap.
		const messageBytes =
			message.sizeBytes ?? message.attachments.reduce((sum, attachment) => sum + attachment.sizeBytes, 0);
		if (messageBytes > config.inboundMaxMessageBytes) {
			throw new PayloadTooLargeException({
				message: `The message exceeds the ${config.inboundMaxMessageBytes}-byte inbound cap`,
				code: DOCS_INBOUND_TOO_LARGE
			});
		}

		// Gate 6 — attachments only; the body is discarded.
		if (!message.attachments.length) {
			throw new BadRequestException({
				message: 'The message carried no attachment — inbound capture is attachments-only',
				code: DOCS_INBOUND_NO_ATTACHMENTS
			});
		}

		const results: IInboundEmailImportResult[] = [];
		for (const attachment of message.attachments) {
			results.push(await this.importAttachment(scope, message, attachment));
		}

		const accepted = results.filter((result) => result.accepted).length;
		this.logger.log(
			`Inbound-email capture for organization ${scope.organizationId}: ${accepted}/${results.length} attachment(s) imported.`
		);

		return {
			adapter: this.adapter.id,
			organizationId: scope.organizationId,
			accepted,
			rejected: results.length - accepted,
			results
		};
	}

	/**
	 * Stores one attachment and creates its `Document` row.
	 *
	 * @param scope The resolved tenant/organization.
	 * @param message The parsed message (provenance only).
	 * @param attachment The attachment to import.
	 * @returns The per-attachment result.
	 */
	private async importAttachment(
		scope: { tenantId: ID; organizationId: ID },
		message: ParsedInboundEmail,
		attachment: IInboundEmailAttachment
	): Promise<IInboundEmailImportResult> {
		const config = getDocsConfig();
		const fileName = attachment.fileName.slice(0, 255);

		// Per-attachment size cap — the same limit the upload endpoint enforces.
		if (attachment.sizeBytes > config.maxFileSize) {
			return { fileName, accepted: false, code: DOCS_INBOUND_TOO_LARGE };
		}

		// The same magic-byte gauntlet as the upload path — a mail attachment is the least
		// trusted input surface this plugin has.
		const sniff = sniffFile(attachment.content, fileName, attachment.contentType);
		if (!sniff.ok) {
			return { fileName, accepted: false, code: sniff.code };
		}

		try {
			const provider = new FileStorage().getProvider();
			const stored = await provider.putFile(
				attachment.content,
				this.buildStorageKey(scope, sniff.type.mimeType)
			);
			const sha256 = createHash('sha256').update(attachment.content).digest('hex');

			const document = await this.typeOrmDocumentRepository.save(
				this.typeOrmDocumentRepository.create({
					tenantId: scope.tenantId,
					organizationId: scope.organizationId,
					kind: DocumentKindEnum.FILE,
					name: fileName,
					status: DocumentStatusEnum.UPLOADED,
					source: DocumentSourceEnum.EMAIL,
					// NEVER auto-imported to knowledge (§17.2) — a human approves first.
					knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
					reviewStatus: DocumentReviewStatusEnum.PENDING,
					reviewReason: DocumentReviewReasonEnum.MANUAL,
					visibility: DocumentVisibilityEnum.ORGANIZATION,
					storageProvider: provider.name.toUpperCase() as FileStorageProviderEnum,
					storageKey: stored.key,
					mimeType: sniff.type.mimeType,
					fileSize: attachment.sizeBytes,
					sha256,
					originalFilename: fileName,
					version: 1,
					metadata: {
						inboundEmail: {
							// Provenance only — no body, no recipient token.
							sender: message.sender ?? null,
							subject: message.subject ?? null,
							messageId: message.messageId ?? null,
							receivedAt: message.receivedAt ?? null,
							canonicalExtension: canonicalExtension(sniff.type.mimeType)
						}
					}
				} as Partial<Document>)
			);

			// Extraction still runs (it feeds the preview + the review queue); indexing does not.
			await this.processingService.enqueueExtract(document, 'upload');

			return { fileName, documentId: document.id, accepted: true };
		} catch (error) {
			this.logger.error(`Inbound-email attachment import failed: ${(error as Error).message}`);
			return { fileName, accepted: false, code: DOCS_INBOUND_NO_ATTACHMENTS };
		}
	}

	/**
	 * Builds the storage key of an inbound attachment — **exactly** the shape the upload
	 * endpoint uses (`DocumentUploadController.documentsStorage`):
	 * `documents/<tenantId>/<organizationId>/<uuid>.<canonicalExtension>`.
	 *
	 * The client-supplied attachment name NEVER enters the key. It is attacker-controlled
	 * on the least trusted input surface this plugin has, and putting it in the key was
	 * three bugs in one: objects of different tenants sharing one flat `documents/inbound/`
	 * prefix collided and overwrote each other, the name carried whatever extension the
	 * sender chose rather than the sniffed one, and a storage adapter that does not
	 * normalize its keys could be walked out of the prefix with `../`. The original name
	 * survives on `name` / `originalFilename`, which are data, not paths.
	 *
	 * @param scope The resolved tenant/organization.
	 * @param mimeType The SNIFFED canonical MIME (never the declared one).
	 * @returns The server-generated storage key.
	 */
	private buildStorageKey(scope: { tenantId: ID; organizationId: ID }, mimeType: string): string {
		// The ids are UUID columns, but a key segment is never built from an unvalidated value.
		// (`randomUUID` rather than the `uuid` package: same v4 shape, no ESM-only dependency.)
		const segment = (value: ID): string => String(value ?? '').replace(/[^a-zA-Z0-9-]/g, '') || randomUUID();
		const extension = canonicalExtension(mimeType);
		return `documents/${segment(scope.tenantId)}/${segment(scope.organizationId)}/${randomUUID()}.${extension}`;
	}

	/**
	 * Extracts the capture token from a `docs-<token>@<domain>` recipient address.
	 *
	 * @param recipient The recipient address.
	 * @returns The token, or null when the address is not a capture address.
	 */
	public extractCaptureToken(recipient?: string): string | null {
		if (!recipient) {
			return null;
		}
		const local = String(recipient).trim().toLowerCase().split('@')[0];
		// Plus-addressing (`docs-<token>+anything@…`) is tolerated; the token is the stem.
		const match = /^docs-([a-z0-9]{16,128})(\+.*)?$/.exec(local);
		return match ? match[1] : null;
	}

	/**
	 * Resolves the organization that owns a capture token by scanning the namespaced
	 * `docs.<organizationId>.inboundToken` settings rows.
	 *
	 * There is no request context on a webhook thread, so the lookup is deliberately
	 * untenanted and the tenant is taken FROM the matched row.
	 *
	 * @param token The capture token.
	 * @returns The tenant/organization scope, or null when no organization owns the token.
	 */
	private async resolveScopeByToken(token: string): Promise<{ tenantId: ID; organizationId: ID } | null> {
		try {
			const rows = await this.typeOrmDocumentRepository.manager.find(TenantSetting, {
				where: {
					name: Like(`${DOCS_SETTING_PREFIX}.%.${DOCS_SETTING_INBOUND_TOKEN}`),
					value: token
				}
			});
			for (const row of rows) {
				const organizationId = this.organizationIdOfSettingName(row.name);
				if (organizationId && row.tenantId) {
					return { tenantId: row.tenantId as ID, organizationId };
				}
			}
			return null;
		} catch (error) {
			this.logger.warn(`Capture-token lookup failed: ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Pulls the organization id out of a `docs.<organizationId>.<key>` setting name.
	 */
	private organizationIdOfSettingName(name: string): ID | null {
		const parts = String(name).split('.');
		return parts.length === 3 ? (parts[1] as ID) : null;
	}
}
