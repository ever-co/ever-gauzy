import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { createHash } from 'crypto';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	FileStorageProviderEnum,
	ID,
	UploadedFile
} from '@gauzy/contracts';
import { FileStorage, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_FILE_TOO_LARGE,
	DOCS_FILE_TYPE_REJECTED,
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
import { canonicalExtension, sniffFile } from './file-sniffer';

/** Sources a client may claim on the upload endpoint — everything else is reserved. */
const UPLOAD_SOURCE_ALLOWLIST = [DocumentSourceEnum.UPLOAD, DocumentSourceEnum.CHAT, DocumentSourceEnum.EDITOR];

/**
 * Sources that are system-originated captures: over quota they WARN and proceed, so
 * automated intake never silently drops a business record (08 §5.7).
 */
const QUOTA_WARN_ONLY_SOURCES = [DocumentSourceEnum.CHAT, DocumentSourceEnum.EMAIL];

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

		if (!files || files.length === 0) {
			throw new BadRequestException({ message: 'No files were uploaded', code: DOCS_FILE_TYPE_REJECTED });
		}

		// Source allowlist: UPLOAD (default) / CHAT / EDITOR only — reserved sources are
		// server-side ingestion paths.
		const source = input.source ?? DocumentSourceEnum.UPLOAD;
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

		const tenantId = RequestContext.currentTenantId();
		const organizationId = input.organizationId;

		// Defaults follow the org settings (`importToKnowledgeDefault`, `defaultVisibility`).
		const defaults = await this.documentSettingsService.getDefaults(organizationId);
		const importToKnowledge = input.importToKnowledge ?? defaults.importToKnowledgeDefault;
		const defaultVisibility = input.visibility ?? defaults.defaultVisibility;

		// Organization storage quota (08 §5.7) — resolved ONCE per batch; the accepted bytes
		// of this batch accumulate into `quotaState.usedBytes` so a batch cannot slip past
		// the limit by being counted against a stale usage number.
		const quotaState = await this.documentQuotaService.getQuotaState(organizationId);
		const quotaWarnOnly = QUOTA_WARN_ONLY_SOURCES.includes(source);

		const results: IDocumentUploadResult[] = [];
		const rejected: IDocumentUploadRejection[] = [];
		let oversizeCount = 0;

		for (const file of files) {
			const fileName = (file.originalname ?? file.filename ?? 'file').slice(0, 255);
			try {
				// 1) Per-file size cap (post-storage enforcement keeps per-file semantics).
				if (file.size > config.maxFileSize) {
					oversizeCount++;
					await this.cleanupOne(provider, file);
					rejected.push({
						fileName,
						code: DOCS_FILE_TOO_LARGE,
						message: `File exceeds the ${config.maxFileSize}-byte limit`
					});
					continue;
				}

				// 1b) Organization storage quota. System captures warn and proceed.
				if (this.documentQuotaService.exceeds(file.size, quotaState)) {
					if (quotaWarnOnly) {
						this.logger.warn(
							`Organization ${organizationId} is over its documents storage quota ` +
								`(${quotaState.usedBytes}/${quotaState.quotaBytes} bytes) — accepting the ` +
								`${source} capture anyway so automated intake never drops a record.`
						);
					} else {
						await this.cleanupOne(provider, file);
						rejected.push({
							fileName,
							code: DOCS_QUOTA_EXCEEDED,
							message:
								`The organization storage quota of ${quotaState.quotaBytes} bytes would be ` +
								`exceeded (currently using ${quotaState.usedBytes} bytes)`
						});
						continue;
					}
				}

				// 2) Content sniffing — never trust the client MIME.
				const buffer = (await provider.getFile(file.key)) as Buffer;
				const sniff = sniffFile(buffer, fileName, file.mimetype);
				if (!sniff.ok) {
					await this.cleanupOne(provider, file);
					rejected.push({ fileName, code: sniff.code, message: sniff.message });
					continue;
				}

				// 3) sha256 + advisory in-org dedup (never blocks the upload).
				const sha256 = createHash('sha256').update(buffer).digest('hex');
				// Soft-deleted rows are excluded by default — dedup is against active rows only,
				// always composite with tenant + organization (no cross-tenant lookup exists).
				const duplicate = await this.typeOrmDocumentRepository.findOne({
					where: {
						tenantId,
						organizationId,
						kind: DocumentKindEnum.FILE,
						sha256
					},
					select: { id: true }
				});

				// 4) Create the row — status UPLOADED; the pipeline takes it from here.
				const document = await this.documentService.create({
					organizationId,
					kind: DocumentKindEnum.FILE,
					name: fileName,
					parentId: input.parentId ?? null,
					visibility: defaultVisibility,
					status: DocumentStatusEnum.UPLOADED,
					source,
					knowledgeStatus: importToKnowledge
						? DocumentKnowledgeStatusEnum.QUEUED
						: DocumentKnowledgeStatusEnum.NONE,
					reviewStatus: DocumentReviewStatusEnum.NONE,
					storageProvider,
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

				// 5) Enqueue extraction with the explicit tenant snapshot.
				await this.processingService.enqueueExtract(document, 'upload');

				// The accepted bytes count against the remaining quota of this same batch.
				quotaState.usedBytes += file.size;

				results.push({ document, duplicateOfId: duplicate?.id });
			} catch (error) {
				this.logger.error(`Upload failed for ${fileName.slice(0, 40)}: ${(error as Error).message}`);
				await this.cleanupOne(provider, file);
				rejected.push({
					fileName,
					code: DOCS_FILE_TYPE_REJECTED,
					message: 'The file could not be processed'
				});
			}
		}

		// 413 only when EVERY file was oversize; any other all-rejected mix is a 400.
		if (results.length === 0 && rejected.length > 0) {
			if (oversizeCount === files.length) {
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

		return { results, rejected };
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
