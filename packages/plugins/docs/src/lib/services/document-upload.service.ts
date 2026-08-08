import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID,
	UploadedFile
} from '@gauzy/contracts';
import { FileStorage, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_FILE_TOO_LARGE,
	DOCS_FILE_TYPE_REJECTED,
	DOCS_NOT_A_FILE,
	DOCS_PARENT_NOT_CONTAINER,
	DOCS_QUOTA_EXCEEDED,
	DOCS_SOURCE_RESERVED
} from '../docs.constants';
import {
	IDocumentUploadRejection,
	IDocumentUploadResponse,
	IDocumentUploadResult,
	UploadDocumentsDTO
} from '../dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentProcessingService } from './document-processing.service';
import { DocumentQuotaService } from './document-quota.service';
import { DocumentService } from './document.service';
import { DocumentSettingsService } from './document-settings.service';
import { canonicalExtension, ISniffResult, sniffFile } from './file-sniffer';
import { IDocumentQuotaState } from './quota.calculator';

/** Sources a client may claim on the upload endpoint — everything else is reserved. */
const UPLOAD_SOURCE_ALLOWLIST = [DocumentSourceEnum.UPLOAD, DocumentSourceEnum.CHAT, DocumentSourceEnum.EDITOR];

/**
 * Sources that are system-originated captures: over quota they WARN and proceed, so
 * automated intake never silently drops a business record (08 §5.7).
 */
const QUOTA_WARN_ONLY_SOURCES = [DocumentSourceEnum.CHAT, DocumentSourceEnum.EMAIL];

/**
 * The ONLY stored types a byte response may render in the browser tab (`08 §5.5`). Everything
 * else — Office formats, csv/txt/md, and above all `text/html` — is served as an attachment
 * with a neutral content type, so the API origin can never execute stored markup.
 */
const INLINE_SAFE_MIME_TYPES = new Set([
	'application/pdf',
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif'
]);

/**
 * Key-shape guard (`08 §5.3`) — runs before every provider `getFile`/`url` call.
 *
 * The prefix itself is deliberately NOT pinned: keys are provider- and ingress-dependent
 * (the LOCAL provider emits Windows separators, the capture and legacy-import paths use their
 * own prefixes). What is pinned is the part that can actually escape the bucket: a traversal
 * segment, an absolute path, a drive letter, or a NUL byte.
 *
 * @param storageKey The persisted storage key.
 * @returns True when the key is safe to hand to a storage provider.
 */
const isSafeStorageKey = (storageKey: string): boolean => {
	const normalized = storageKey.replace(/\\/g, '/');
	if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) {
		return false;
	}
	if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
		return false;
	}
	return !normalized.split('/').includes('..');
};

/**
 * Everything an upload batch resolves exactly once, threaded into the per-file gauntlet.
 *
 * Resolving these on the request thread (rather than per file, or in the worker) is deliberate:
 * `getDefaults()` reads the tenant off `RequestContext`, and the quota has to be a single
 * running number for the whole batch — see `resolveBatchContext`.
 */
interface IUploadBatchContext {
	/** The multipart form fields of the batch. */
	input: UploadDocumentsDTO;
	/** The already-resolved storage provider instance the interceptor streamed into. */
	provider: any;
	source: DocumentSourceEnum;
	tenantId: ID;
	organizationId: ID;
	storageProvider: FileStorageProviderEnum;
	/** Per-file size cap in bytes (`GAUZY_DOCS_MAX_FILE_SIZE`). */
	maxFileSize: number;
	importToKnowledge: boolean;
	defaultVisibility: DocumentVisibilityEnum;
	classifyWithAi: boolean;
	/** Mutable: the accepted bytes of this batch accumulate into `usedBytes`. */
	quotaState: IDocumentQuotaState;
	/** True for system-originated captures — over quota they WARN and proceed. */
	quotaWarnOnly: boolean;
}

/**
 * The outcome of one file of a batch — exactly one of `result` / `rejection` is set.
 *
 * A rejection is *returned*, never thrown, and carries no `fileName`: the caller owns the
 * uniform rejection handling (drop the stored blob, then record it), so every reject path
 * cleans up identically.
 */
interface IUploadFileOutcome {
	/** Set when the file was accepted. */
	result?: IDocumentUploadResult;
	/** Set when the file was rejected — the wire code and message. */
	rejection?: Omit<IDocumentUploadRejection, 'fileName'>;
	/** True only for the per-file size cap — drives the batch-level 413-vs-400 decision. */
	oversize?: boolean;
}

/** The byte payload of `GET /documents/:id/raw`, already hardened for the wire. */
export interface IDocumentRawFile {
	buffer: Buffer;
	/** Never the stored `text/html`; see `INLINE_SAFE_MIME_TYPES`. */
	contentType: string;
	disposition: 'inline' | 'attachment';
	/** Sanitized, RFC 5987-encodable download name. */
	fileName: string;
}

/**
 * The upload gauntlet of the Documents plugin: per-file magic-byte sniffing against the
 * security allowlist, size enforcement, sha256 dedup lookup, rejected-blob cleanup,
 * initial `Document` row creation (`kind: FILE`, `status: UPLOADED`), and the
 * `docs.extract` enqueue with an explicit tenant snapshot.
 *
 * Validation is per-file with per-file accept/reject results — one invalid file never
 * fails the batch. 413 is returned only when **every** file is oversize; all-rejected
 * (for any mix of reasons) is a 400.
 */
@Injectable()
export class DocumentUploadService {
	private readonly logger = new Logger(DocumentUploadService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly documentService: DocumentService,
		private readonly documentSettingsService: DocumentSettingsService,
		private readonly documentQuotaService: DocumentQuotaService,
		private readonly processingService: DocumentProcessingService
	) {}

	/**
	 * Processes one upload batch (1–10 files already streamed into storage by the
	 * interceptor) into per-file accept/reject results.
	 *
	 * @param input The multipart form fields.
	 * @param files The provider-mapped uploaded files.
	 * @returns The per-file result envelope (201 on the wire).
	 */
	async uploadDocuments(input: UploadDocumentsDTO, files: UploadedFile[]): Promise<IDocumentUploadResponse> {
		const config = getDocsConfig();
		const provider = new FileStorage().getProvider();
		const storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;
		const source = input.source ?? DocumentSourceEnum.UPLOAD;

		// Batch-level gates first — an empty batch, the source allowlist, the parent kind.
		await this.assertBatchAccepted(input, files, provider, source);

		const context = await this.resolveBatchContext(input, {
			provider,
			source,
			storageProvider,
			maxFileSize: config.maxFileSize
		});

		const results: IDocumentUploadResult[] = [];
		const rejected: IDocumentUploadRejection[] = [];
		let oversizeCount = 0;

		for (const file of files) {
			const fileName = (file.originalname ?? file.filename ?? 'file').slice(0, 255);
			const outcome = await this.processFile(file, fileName, context);

			if (outcome.result) {
				results.push(outcome.result);
				continue;
			}

			// Every rejection path — size, quota, sniffing, or an unexpected error — drops the
			// just-stored blob before the rejection is recorded. Bytes of a rejected file are
			// never persisted.
			if (outcome.oversize) {
				oversizeCount++;
			}
			await this.cleanupOne(provider, file);
			rejected.push({ fileName, code: outcome.rejection.code, message: outcome.rejection.message });
		}

		if (results.length === 0 && rejected.length > 0) {
			this.throwBatchRejected(rejected, oversizeCount === files.length);
		}

		return { results, rejected };
	}

	/**
	 * The batch-level gates, in the order the security contract fixes them: an empty batch, then
	 * the source allowlist, then the parent-kind check. Both post-allowlist failures drop every
	 * blob the interceptor already streamed into storage before throwing.
	 *
	 * @param input The multipart form fields.
	 * @param files The provider-mapped uploaded files.
	 * @param provider The resolved storage provider (for cleanup).
	 * @param source The claimed source, already defaulted to `UPLOAD`.
	 */
	private async assertBatchAccepted(
		input: UploadDocumentsDTO,
		files: UploadedFile[],
		provider: any,
		source: DocumentSourceEnum
	): Promise<void> {
		if (!files || files.length === 0) {
			throw new BadRequestException({ message: 'No files were uploaded', code: DOCS_FILE_TYPE_REJECTED });
		}

		// Source allowlist: UPLOAD (default) / CHAT / EDITOR only — reserved sources are
		// server-side ingestion paths.
		if (!UPLOAD_SOURCE_ALLOWLIST.includes(source)) {
			await this.cleanupAll(provider, files);
			throw new BadRequestException({
				message: `Source ${input.source} is reserved for server-side ingestion`,
				code: DOCS_SOURCE_RESERVED
			});
		}

		// Parent must be a container (FOLDER or PAGE).
		if (input.parentId) {
			const parent = await this.documentService.findOneScoped(input.parentId);
			if (parent.kind === DocumentKindEnum.FILE) {
				await this.cleanupAll(provider, files);
				throw new BadRequestException({
					message: 'A FILE document can never be a parent',
					code: DOCS_PARENT_NOT_CONTAINER
				});
			}
		}
	}

	/**
	 * Resolves everything the batch needs exactly once: the org defaults each form field can
	 * override, and the organization storage-quota state.
	 *
	 * 🛑 The classification decision is resolved HERE, on the request thread: `getDefaults()`
	 * reads the tenant off `RequestContext`, which the queue/inline pipeline threads do not have.
	 * The answer rides on the `docs.extract` payload instead of being re-derived in the worker.
	 *
	 * The quota (08 §5.7) is likewise resolved ONCE per batch; the accepted bytes of this batch
	 * accumulate into `quotaState.usedBytes` so a batch cannot slip past the limit by being
	 * counted against a stale usage number.
	 *
	 * @param input The multipart form fields.
	 * @param seed The values already resolved on the request thread by the caller.
	 * @returns The per-batch context threaded into every file.
	 */
	private async resolveBatchContext(
		input: UploadDocumentsDTO,
		seed: Pick<IUploadBatchContext, 'provider' | 'source' | 'storageProvider' | 'maxFileSize'>
	): Promise<IUploadBatchContext> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = input.organizationId;

		// Defaults follow the org settings (`importToKnowledgeDefault`, `defaultVisibility`,
		// `autoClassify`); each form field is a per-upload override of its own default.
		const defaults = await this.documentSettingsService.getDefaults(organizationId);
		const quotaState = await this.documentQuotaService.getQuotaState(organizationId);

		return {
			...seed,
			input,
			tenantId,
			organizationId,
			importToKnowledge: input.importToKnowledge ?? defaults.importToKnowledgeDefault,
			defaultVisibility: input.visibility ?? defaults.defaultVisibility,
			classifyWithAi: input.classifyWithAi ?? defaults.autoClassify,
			quotaState,
			quotaWarnOnly: QUOTA_WARN_ONLY_SOURCES.includes(seed.source)
		};
	}

	/**
	 * Runs one file through the gauntlet, in the fixed order the security contract requires:
	 * 1) per-file size cap, 1b) organization quota, 2) magic-byte sniffing, 3) sha256 + dedup,
	 * 4) row creation, 5) `docs.extract` enqueue.
	 *
	 * Rejections are returned rather than thrown so the caller can apply the one cleanup-and-
	 * record path to all of them; an unexpected error anywhere in the gauntlet degrades to the
	 * same generic rejection the inline try/catch always produced.
	 *
	 * @param file The stored upload.
	 * @param fileName The already-truncated display name.
	 * @param context The per-batch context.
	 * @returns The accepted result, or the rejection to record.
	 */
	private async processFile(
		file: UploadedFile,
		fileName: string,
		context: IUploadBatchContext
	): Promise<IUploadFileOutcome> {
		try {
			// 1) Per-file size cap (post-storage enforcement keeps per-file semantics).
			if (file.size > context.maxFileSize) {
				return {
					oversize: true,
					rejection: {
						code: DOCS_FILE_TOO_LARGE,
						message: `File exceeds the ${context.maxFileSize}-byte limit`
					}
				};
			}

			// 1b) Organization storage quota. System captures warn and proceed.
			const overQuota = this.rejectOverQuota(file, context);
			if (overQuota) {
				return overQuota;
			}

			// 2) Content sniffing — never trust the client MIME.
			const buffer = (await context.provider.getFile(file.key)) as Buffer;
			const sniff = sniffFile(buffer, fileName, file.mimetype);
			if (!sniff.ok) {
				return { rejection: { code: sniff.code, message: sniff.message } };
			}

			// 3) sha256 + advisory in-org dedup (never blocks the upload).
			const sha256 = createHash('sha256').update(buffer).digest('hex');
			const duplicate = await this.findDuplicate(sha256, context);

			const document = await this.storeAcceptedFile(file, fileName, sniff, sha256, context);

			return { result: { document, duplicateOfId: duplicate?.id } };
		} catch (error) {
			this.logger.error(`Upload failed for ${fileName.slice(0, 40)}: ${(error as Error).message}`);
			return { rejection: { code: DOCS_FILE_TYPE_REJECTED, message: 'The file could not be processed' } };
		}
	}

	/**
	 * Organization storage quota check (08 §5.7). System-originated captures (`QUOTA_WARN_ONLY_
	 * SOURCES`) WARN and proceed so automated intake never silently drops a business record;
	 * every other source is rejected.
	 *
	 * @param file The stored upload.
	 * @param context The per-batch context (its `quotaState` carries the running batch usage).
	 * @returns The rejection to record, or `null` when the file may proceed.
	 */
	private rejectOverQuota(file: UploadedFile, context: IUploadBatchContext): IUploadFileOutcome | null {
		const { organizationId, quotaState, source } = context;

		if (!this.documentQuotaService.exceeds(file.size, quotaState)) {
			return null;
		}
		if (context.quotaWarnOnly) {
			this.logger.warn(
				`Organization ${organizationId} is over its documents storage quota ` +
					`(${quotaState.usedBytes}/${quotaState.quotaBytes} bytes) — accepting the ` +
					`${source} capture anyway so automated intake never drops a record.`
			);
			return null;
		}
		return {
			rejection: {
				code: DOCS_QUOTA_EXCEEDED,
				message:
					`The organization storage quota of ${quotaState.quotaBytes} bytes would be ` +
					`exceeded (currently using ${quotaState.usedBytes} bytes)`
			}
		};
	}

	/**
	 * Advisory in-org dedup lookup — it never blocks the upload, it only reports the twin.
	 *
	 * Soft-deleted rows are excluded by default: dedup is against active rows only, always
	 * composite with tenant + organization (no cross-tenant lookup exists).
	 *
	 * @param sha256 The digest of the stored bytes.
	 * @param context The per-batch context.
	 * @returns The existing document id holder, or undefined/null when there is no twin.
	 */
	private async findDuplicate(sha256: string, context: IUploadBatchContext): Promise<Document> {
		return this.typeOrmDocumentRepository.findOne({
			where: {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				kind: DocumentKindEnum.FILE,
				sha256
			},
			select: { id: true }
		});
	}

	/**
	 * Persists one accepted file: the initial `Document` row (`kind: FILE`, `status: UPLOADED`),
	 * the `created` CRUD event, and the `docs.extract` enqueue carrying this batch's explicit
	 * tenant snapshot and classification decision. Finally the accepted bytes count against the
	 * remaining quota of this same batch.
	 *
	 * @param file The stored upload.
	 * @param fileName The already-truncated display name.
	 * @param sniff The successful sniff result — its canonical MIME wins over the declared one.
	 * @param sha256 The digest of the stored bytes.
	 * @param context The per-batch context.
	 * @returns The created document row.
	 */
	private async storeAcceptedFile(
		file: UploadedFile,
		fileName: string,
		sniff: ISniffResult,
		sha256: string,
		context: IUploadBatchContext
	): Promise<Document> {
		const { input } = context;

		// 4) Create the row — status UPLOADED; the pipeline takes it from here.
		const document = await this.documentService.create({
			organizationId: context.organizationId,
			kind: DocumentKindEnum.FILE,
			name: fileName,
			parentId: input.parentId ?? null,
			visibility: context.defaultVisibility,
			status: DocumentStatusEnum.UPLOADED,
			source: context.source,
			knowledgeStatus: context.importToKnowledge
				? DocumentKnowledgeStatusEnum.QUEUED
				: DocumentKnowledgeStatusEnum.NONE,
			reviewStatus: DocumentReviewStatusEnum.NONE,
			storageProvider: context.storageProvider,
			storageKey: file.key,
			mimeType: sniff.type.mimeType,
			fileSize: file.size,
			sha256,
			originalFilename: fileName,
			version: 1,
			categories: (input.categoryIds ?? []).map((id: ID) => ({ id })) as any,
			tags: (input.tagIds ?? []).map((id: ID) => ({ id })) as any,
			metadata: {
				upload: {
					declaredMimeType: file.mimetype ?? null,
					canonicalExtension: canonicalExtension(sniff.type.mimeType)
				}
			}
		});

		this.documentService.emitDocumentEvent(document, 'created', { phase: 'crud' });

		// 5) Enqueue extraction with the explicit tenant snapshot, carrying this
		// batch's classification decision to the pipeline.
		await this.processingService.enqueueExtract(document, 'upload', { classify: context.classifyWithAi });

		// The accepted bytes count against the remaining quota of this same batch.
		context.quotaState.usedBytes += file.size;

		return document;
	}

	/**
	 * The batch-level failure raised when nothing was accepted: 413 only when EVERY file was
	 * oversize; any other all-rejected mix is a 400. The per-file rejections ride along either
	 * way so the client can report them file by file.
	 *
	 * @param rejected The per-file rejections of the batch.
	 * @param allOversize Whether every file of the batch tripped the size cap.
	 */
	private throwBatchRejected(rejected: IDocumentUploadRejection[], allOversize: boolean): never {
		if (allOversize) {
			throw new PayloadTooLargeException({
				message: 'Every file in the batch exceeds the size limit',
				code: DOCS_FILE_TOO_LARGE,
				rejected
			});
		}
		throw new BadRequestException({
			message: 'Every file in the batch was rejected',
			code: DOCS_FILE_TYPE_REJECTED,
			rejected
		});
	}

	/**
	 * `GET /documents/:id/download` — resolves a provider URL for the stored blob and returns
	 * `{ url }`; the client navigates/streams from there. S3-compatible providers sign the URL
	 * (`expiresIn: 3600`, existing provider behavior), so it is minted per request and never
	 * persisted or cached.
	 *
	 * @param id The FILE document id.
	 * @returns The resolved provider URL.
	 */
	async getDownloadUrl(id: ID): Promise<{ url: string }> {
		const document = await this.requireFileDocument(id);
		const provider = new FileStorage().setProvider(document.storageProvider).getProviderInstance();

		const url = await provider.url(document.storageKey);
		if (!url) {
			throw new NotFoundException(`Document ${id} has no retrievable file`);
		}
		return { url };
	}

	/**
	 * `GET /documents/:id/raw` — the authenticated byte path used by previews and by every
	 * image embedded in a wiki page. Returns the blob together with the response hardening the
	 * caller must apply (`08 §5.5`): a safe content type, and `inline` only for the small
	 * render-safe allowlist.
	 *
	 * Stored `text/html` is deliberately never returned as `text/html` — serving it inline from
	 * the API origin would turn an upload into same-origin stored XSS. HTML previews render the
	 * sanitized copy instead.
	 *
	 * @param id The FILE document id.
	 * @returns The blob plus its hardened response metadata.
	 */
	async getRawFile(id: ID): Promise<IDocumentRawFile> {
		const document = await this.requireFileDocument(id);
		const provider = new FileStorage().setProvider(document.storageProvider).getProviderInstance();

		const buffer = (await provider.getFile(document.storageKey)) as Buffer;
		if (!buffer) {
			throw new NotFoundException(`Document ${id} has no retrievable file`);
		}

		const storedMimeType = document.mimeType ?? '';
		const inlineSafe = INLINE_SAFE_MIME_TYPES.has(storedMimeType);
		return {
			buffer,
			contentType: inlineSafe ? storedMimeType : 'application/octet-stream',
			disposition: inlineSafe ? 'inline' : 'attachment',
			fileName: this.safeFileName(document.originalFilename ?? document.name ?? 'document')
		};
	}

	/**
	 * Resolves a FILE document through the read scope (404 on a cross-org / invisible id) and
	 * validates its storage key shape before any provider call.
	 */
	private async requireFileDocument(id: ID): Promise<Document> {
		const document = await this.documentService.findOneScoped(id);

		if (document.kind !== DocumentKindEnum.FILE) {
			throw new ConflictException({
				message: 'Only FILE documents carry stored bytes',
				code: DOCS_NOT_A_FILE
			});
		}
		if (!document.storageKey || !document.storageProvider) {
			throw new NotFoundException(`Document ${id} has no retrievable file`);
		}
		if (!isSafeStorageKey(document.storageKey)) {
			// Never hand a traversal / absolute-path key to a provider (08 §5.3).
			this.logger.error(`Refusing provider access for document ${id}: unexpected storage key shape`);
			throw new NotFoundException(`Document ${id} has no retrievable file`);
		}
		return document;
	}

	/**
	 * Strips CR/LF, quotes, semicolons and non-printable characters out of a name before it can
	 * reach a `Content-Disposition` header (08 §5.3).
	 */
	private safeFileName(name: string): string {
		// CR (U+000D) and LF (U+000A) are not listed separately: the U+0000-U+001F range below
		// already covers them, and naming them twice is the duplicate the character class was
		// flagged for. The header-injection bytes this guards against are unchanged.
		// eslint-disable-next-line no-control-regex
		const stripped = name.replace(/["'\\;\u0000-\u001F\u007F]/g, '').trim();
		return stripped.slice(0, 255) || 'document';
	}

	/**
	 * Deletes one just-stored blob after a rejection (the image-asset cleanup discipline
	 * — bytes of a rejected file are never persisted).
	 */
	private async cleanupOne(provider: any, file: UploadedFile): Promise<void> {
		if (!file?.key || file.key.includes('..')) {
			return;
		}
		try {
			await provider.deleteFile(file.key);
		} catch (error) {
			this.logger.error(`Failed to delete rejected upload blob: ${(error as Error).message}`);
		}
	}

	/**
	 * Deletes every stored blob of a batch (batch-level rejections).
	 */
	private async cleanupAll(provider: any, files: UploadedFile[]): Promise<void> {
		for (const file of files) {
			await this.cleanupOne(provider, file);
		}
	}
}
