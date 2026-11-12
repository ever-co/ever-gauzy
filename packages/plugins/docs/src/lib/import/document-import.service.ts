import {
	BadRequestException,
	HttpException,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException
} from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import {
	DocumentImportStatusEnum,
	DocumentKindEnum,
	DocumentVisibilityEnum,
	FileStorageProviderEnum,
	ID,
	IDocumentImport,
	IDocumentImportList,
	PermissionsEnum,
	UploadedFile
} from '@gauzy/contracts';
import { FileStorage, readStorageFileAsBuffer, RequestContext } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_IMPORT_DISABLED,
	DOCS_IMPORT_FILE_REQUIRED,
	DOCS_IMPORT_LIST_LIMIT,
	DOCS_IMPORT_NO_PAGES,
	DOCS_IMPORT_REPORT_MAX_ITEMS,
	DOCS_IMPORT_STALE_MINUTES,
	DOCS_IMPORT_TOO_LARGE,
	DOCS_IMPORT_TOO_MANY_ENTRIES,
	DOCS_PARENT_NOT_CONTAINER,
	DOCS_RECOVERY_STARTUP_DELAY_MS
} from '../docs.constants';
import { CreateDocumentImportDTO } from '../dto/document-import.dto';
import { DocumentImport } from '../entities/document-import.entity';
import { DOCS_JOB_IMPORT } from '../knowledge/queue/constants';
import { IDocsImportJob } from '../knowledge/queue/docs-job.types';
import { DocsQueueService } from '../knowledge/queue/docs-queue.service';
import { TypeOrmDocumentImportRepository } from '../repositories/type-orm-document-import.repository';
import { DocumentQuotaService } from '../services/document-quota.service';
import { DocumentSettingsService } from '../services/document-settings.service';
import { DocumentService } from '../services/document.service';
import { IImportOptions, IImportRow } from './document-import.types';
import { importStaleAction, toImportView } from './document-import.view';
import { IImportArchiveLimits, ImportArchiveError, openImportArchive } from './import-archive';
import { importArchiveLimits } from './import-limits';
import { buildImportPlan, detectImportLayout } from './import-plan';
import { ImportTenantStorage } from './import-tenant-storage';

/** C0 control characters and DEL (built from code points: a literal range in a pattern is a lint error). */
const CONTROL_CHARACTERS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}]`, 'g');

/** A file name as data: no path, no control characters, at most 255 characters. */
function safeFileName(name: unknown): string {
	const base = String(name ?? '').split(/[\\/]/).pop() ?? '';
	return base.replace(CONTROL_CHARACTERS, '').trim().slice(0, 255) || 'import.zip';
}

/**
 * The request side of the import of exported workspaces (`docs-import-export` spec FR-1 … FR-5, FR-12):
 *
 * - **start**: the target is resolved as a page create resolves it — a parent the caller may write (its space
 *   follows), or a space (the organization default visibility when none is named; a team the caller belongs to); the
 *   uploaded zip (already in storage, under the request's tenant and organization) is inspected before anything is
 *   created and deleted when it is refused; the organization's quota and knowledge default are resolved here, where
 *   there is a request context, and stored on the row; then the `docs.import` job.
 * - **read**: the caller's own imports only (a Docs manager reads any of the organization's); a stalled one is resumed.
 * - **sweep**: stalled imports are resumed once the process has settled, then every stale window (an import whose job
 *   is lost while the process runs is resumed without anyone opening it).
 */
@Injectable()
export class DocumentImportService {
	private readonly logger = new Logger(DocumentImportService.name);
	private startupTimer?: ReturnType<typeof setTimeout>;
	private sweepTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly imports: TypeOrmDocumentImportRepository,
		private readonly documentService: DocumentService,
		private readonly settings: DocumentSettingsService,
		private readonly quota: DocumentQuotaService,
		private readonly queue: DocsQueueService,
		private readonly storage: ImportTenantStorage
	) {}

	/** 404 `DOCS_IMPORT_DISABLED` while `GAUZY_DOCS_IMPORT_ENABLED` is off. */
	assertEnabled(): void {
		if (!getDocsConfig().importEnabled) {
			throw new NotFoundException({ message: 'Importing exported workspaces is not enabled on this installation', code: DOCS_IMPORT_DISABLED });
		}
	}

	/** The caller's last imports (newest first) and the largest zip the import takes — the clients' capability probe. */
	async list(organizationId?: ID): Promise<IDocumentImportList> {
		this.assertEnabled();
		const scope = this.scopeOf(organizationId);
		const rows = await this.imports.find({
			where: { tenantId: scope.tenantId, organizationId: scope.organizationId, createdByUserId: RequestContext.currentUserId() } as never,
			order: { createdAt: 'DESC' },
			take: DOCS_IMPORT_LIST_LIMIT
		});
		return { items: rows.map((row) => toImportView(row as unknown as IImportRow, false)), maxZipBytes: getDocsConfig().importMaxZipBytes };
	}

	/**
	 * Starts an import of the uploaded zip.
	 *
	 * @param file The uploaded zip, already stored under the request's tenant and organization.
	 * @param input The target.
	 */
	async start(file: UploadedFile | undefined, input: CreateDocumentImportDTO): Promise<IDocumentImport> {
		this.assertEnabled();
		if (!file?.key) {
			throw new BadRequestException({ message: 'An import takes one zip file (multipart field "file")', code: DOCS_IMPORT_FILE_REQUIRED });
		}
		const provider = new FileStorage().getProvider();
		const storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;
		const discard = () => provider.deleteFile(file.key).catch(() => undefined);
		try {
			const config = getDocsConfig();
			if (Number(file.size) > config.importMaxZipBytes) {
				throw new PayloadTooLargeException({ message: `The zip is larger than the ${config.importMaxZipBytes} bytes the import takes`, code: DOCS_IMPORT_TOO_LARGE });
			}
			const organizationId = this.documentService.resolveOrganizationId(input as never);
			const target = await this.resolveTarget(input, organizationId);
			const limits = importArchiveLimits();
			const buffer = await readStorageFileAsBuffer(provider, file.key, { maxBytes: config.importMaxZipBytes });
			const { layout, totalItems } = await this.inspect(buffer, limits);
			const [quotaBytes, defaults] = await Promise.all([this.quota.getQuotaBytes(organizationId), this.settings.getDefaults(organizationId)]);
			const options: IImportOptions = {
				quotaBytes,
				importToKnowledge: defaults?.importToKnowledgeDefault === true,
				maxFileSize: config.maxFileSize,
				limits,
				initiatedByUserId: RequestContext.currentUserId()
			};
			const row = await this.imports.save(
				this.imports.create({
					tenantId: RequestContext.currentTenantId(),
					organizationId,
					status: DocumentImportStatusEnum.QUEUED,
					layout,
					fileName: safeFileName(file.originalname),
					fileSize: Number(file.size) || buffer.length,
					storageProvider,
					storageKey: file.key,
					parentId: target.parentId,
					visibility: target.visibility,
					organizationTeamId: target.organizationTeamId,
					totalItems,
					processedItems: 0,
					optionsJson: JSON.stringify(options),
					lastProgressAt: new Date()
				} as Partial<DocumentImport> as DocumentImport)
			);
			await this.enqueue(row as unknown as IImportRow);
			return toImportView(row as unknown as IImportRow);
		} catch (error) {
			await discard();
			if (error instanceof ImportArchiveError) {
				throw new HttpException({ statusCode: error.status, message: error.message, code: error.code }, error.status);
			}
			throw error;
		}
	}

	/**
	 * One import with its report — the caller's own, or any of the organization's for a Docs manager (404 otherwise).
	 * A stalled import is resumed (or failed, once it has had its runs) before it is answered.
	 */
	async get(id: ID, organizationId?: ID): Promise<IDocumentImport> {
		this.assertEnabled();
		const scope = this.scopeOf(organizationId);
		const row = (await this.imports.findOne({ where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } })) as unknown as IImportRow | null;
		const mayRead = row && (row.createdByUserId === RequestContext.currentUserId() || RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE));
		if (!row || !mayRead) {
			throw new NotFoundException(`Import ${id} not found`);
		}
		return toImportView(await this.resumeIfStale(row));
	}

	/**
	 * Schedules the sweep of stalled imports: once after the settle delay the recovery scan uses, then every stale
	 * window. A sweep and a read that find the same import stalled resume it once (the conditional update).
	 */
	scheduleStartupResume(): void {
		if (!getDocsConfig().importEnabled) return;
		const sweep = () => {
			this.resumeStale().catch((error: Error) => this.logger.error(`Import resume sweep failed: ${error.message}`));
		};
		this.startupTimer = setTimeout(sweep, DOCS_RECOVERY_STARTUP_DELAY_MS);
		this.startupTimer.unref?.();
		this.sweepTimer = setInterval(sweep, DOCS_IMPORT_STALE_MINUTES * 60_000);
		this.sweepTimer.unref?.();
	}

	cancelStartupResume(): void {
		if (this.startupTimer) clearTimeout(this.startupTimer);
		if (this.sweepTimer) clearInterval(this.sweepTimer);
		this.startupTimer = undefined;
		this.sweepTimer = undefined;
	}

	/** Resumes (or fails) every stalled import — every tenant's: a sweep runs without a request context. */
	async resumeStale(now: Date = new Date()): Promise<number> {
		const before = new Date(now.getTime() - DOCS_IMPORT_STALE_MINUTES * 60_000);
		const rows = (await this.imports.find({
			where: { status: In([DocumentImportStatusEnum.QUEUED, DocumentImportStatusEnum.RUNNING]), lastProgressAt: LessThan(before) } as never,
			take: 100
		})) as unknown as IImportRow[];
		let resumed = 0;
		for (const row of rows) {
			const after = await this.resumeIfStale(row, now);
			if (after.status === DocumentImportStatusEnum.QUEUED) resumed += 1;
		}
		if (rows.length) this.logger.log(`Import resume sweep: ${resumed} of ${rows.length} stalled import(s) re-enqueued`);
		return resumed;
	}

	/** A stalled import re-enqueued (back to QUEUED) or failed; any other one as it is. */
	private async resumeIfStale(row: IImportRow, now: Date = new Date()): Promise<IImportRow> {
		const action = importStaleAction(row, now);
		if (action === 'none') return row;
		const patch =
			action === 'fail'
				? {
						status: DocumentImportStatusEnum.FAILED,
						errorCode: 'DOCS_IMPORT_STALLED',
						errorMessage: `The import stopped making progress ${row.attempts ?? 0} times and was given up.`,
						finishedAt: now
					}
				: { status: DocumentImportStatusEnum.QUEUED, lastProgressAt: now };
		// A conditional update: of two readers (or a reader and the sweep) that both found the import stalled, one wins;
		// the other sees no row changed and enqueues nothing.
		const staleBefore = new Date(now.getTime() - DOCS_IMPORT_STALE_MINUTES * 60_000);
		const result = await this.imports.update(
			{
				id: row.id,
				tenantId: row.tenantId,
				organizationId: row.organizationId,
				status: In([DocumentImportStatusEnum.QUEUED, DocumentImportStatusEnum.RUNNING]),
				lastProgressAt: LessThan(staleBefore)
			} as never,
			patch as never
		);
		if (!result?.affected) return row;
		if (action === 'resume') await this.enqueue(row, `:resume-${now.getTime()}`);
		// Given up: no run will clean up after it, so its uploaded zip goes now.
		else await this.discardArchive(row);
		return { ...row, ...patch, ...(action === 'fail' ? { storageKey: null } : {}) };
	}

	/** Deletes the uploaded zip of an import through the storage it was written to, and forgets its key. */
	private async discardArchive(row: IImportRow): Promise<void> {
		if (!row.storageKey) return;
		const key = row.storageKey;
		try {
			// The sweep runs without a request: the tenant's own storage settings name the bucket the zip went to.
			await this.storage.run(row.tenantId, async () => {
				const provider = new FileStorage().setProvider(row.storageProvider ?? undefined).getProviderInstance();
				await provider.deleteFile(key);
			});
			await this.imports.update(
				{ id: row.id, tenantId: row.tenantId, organizationId: row.organizationId } as never,
				{ storageKey: null } as never
			);
		} catch (error) {
			this.logger.warn(`docs.import ${row.id}: the uploaded zip could not be deleted: ${(error as Error)?.message ?? error}`);
		}
	}

	/** Enqueues the `docs.import` job of a row (a run-unique id for a resume, so a retained finished job cannot swallow it). */
	private async enqueue(row: IImportRow, suffix = ''): Promise<void> {
		const payload: IDocsImportJob = {
			documentId: row.id,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			reason: 'import',
			initiatedByUserId: row.createdByUserId ?? undefined
		};
		await this.queue.enqueue(DOCS_JOB_IMPORT, payload, suffix ? { jobId: `${this.queue.jobIdFor(DOCS_JOB_IMPORT, row.id)}${suffix}` } : {});
	}

	/**
	 * The target of the import, resolved as a page create resolves it: a parent must be a page or a folder the caller
	 * may write (the imported pages take its space); without one, the space named (or the organization's default).
	 */
	private async resolveTarget(
		input: CreateDocumentImportDTO,
		organizationId: ID
	): Promise<{ parentId: ID | null; visibility: DocumentVisibilityEnum; organizationTeamId: ID | null }> {
		if (input.parentId) {
			const parent = await this.documentService.findOneScoped(input.parentId, [], organizationId);
			if (parent.kind === DocumentKindEnum.FILE) {
				throw new BadRequestException({ message: 'A FILE document can never be a parent', code: DOCS_PARENT_NOT_CONTAINER });
			}
			await this.documentService.assertCanWrite(parent);
			return {
				parentId: parent.id as ID,
				visibility: parent.visibility ?? DocumentVisibilityEnum.ORGANIZATION,
				organizationTeamId: parent.visibility === DocumentVisibilityEnum.TEAM ? (parent.organizationTeamId ?? null) : null
			};
		}
		let visibility = input.visibility;
		if (!visibility) {
			const defaults = await this.settings.getDefaults(organizationId).catch(() => null);
			visibility = defaults?.defaultVisibility ?? DocumentVisibilityEnum.ORGANIZATION;
		}
		const space = await this.documentService.resolveSpaceFields(visibility, input.organizationTeamId ?? null, organizationId);
		return {
			parentId: null,
			visibility: (space.visibility as DocumentVisibilityEnum) ?? visibility,
			organizationTeamId: (space.organizationTeamId as ID) ?? null
		};
	}

	/** The archive checked whole (its limits, paths, links, at least one page); the planned item count. */
	private async inspect(buffer: Buffer, limits: IImportArchiveLimits) {
		const archive = await openImportArchive(buffer, limits);
		const paths = archive.entries.map((entry) => entry.path);
		const layout = detectImportLayout(paths, archive.directories);
		if (!layout) {
			throw new ImportArchiveError(DOCS_IMPORT_NO_PAGES, 'The archive holds no page file: it is not an exported workspace.');
		}
		const plan = buildImportPlan(paths, archive.directories, layout);
		// The report keeps an outcome for every item it plans (folders included): an archive that plans more is refused.
		if (plan.nodes.length > DOCS_IMPORT_REPORT_MAX_ITEMS) {
			throw new ImportArchiveError(
				DOCS_IMPORT_TOO_MANY_ENTRIES,
				`The archive makes ${plan.nodes.length} folders, pages and files; an import takes at most ${DOCS_IMPORT_REPORT_MAX_ITEMS}.`,
				413
			);
		}
		const pages = plan.nodes.filter((node) => node.kind === DocumentKindEnum.PAGE).length;
		return { layout, totalItems: plan.nodes.length + pages };
	}

	private scopeOf(organizationId?: ID): { tenantId: ID; organizationId: ID } {
		return { tenantId: RequestContext.currentTenantId() as ID, organizationId: this.documentService.resolveOrganizationId({ organizationId }) };
	}
}
