import { ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsNull, MoreThan } from 'typeorm';
import { DocumentKindEnum, ID, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_LOCKED, DOCS_NOT_A_PAGE } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { MikroOrmDocumentVersionRepository } from '../repositories/mikro-orm-document-version.repository';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { TypeOrmDocumentVersionRepository } from '../repositories/type-orm-document-version.repository';

@Injectable()
export class DocumentVersionService extends TenantAwareCrudService<DocumentVersion> {
	private readonly logger = new Logger(DocumentVersionService.name);

	constructor(
		public readonly typeOrmDocumentVersionRepository: TypeOrmDocumentVersionRepository,
		public readonly mikroOrmDocumentVersionRepository: MikroOrmDocumentVersionRepository,
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository
	) {
		super(typeOrmDocumentVersionRepository, mikroOrmDocumentVersionRepository);
	}

	/**
	 * Captures a debounced PAGE version snapshot of the **pre-update** content.
	 *
	 * Debounce: if the newest snapshot for (`documentId`, current employee) is younger than the
	 * window — default 10 minutes, env `GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES` — the capture is
	 * skipped (the autosave stream rolls up into the previous snapshot). A *different* editor
	 * always captures immediately, so no author's work is silently absorbed into someone else's
	 * snapshot. `document.version` increments exactly with capture count.
	 *
	 * @param document The loaded document (pre-update state).
	 * @param options `force: true` bypasses the debounce (explicit snapshot / restore path).
	 * @returns The captured version, or null when the debounce absorbed the save.
	 */
	async captureSnapshotIfNeeded(document: Document, options: { force?: boolean } = {}): Promise<DocumentVersion | null> {
		// Applicability guard: PAGE only, with some content to snapshot
		if (document.kind !== DocumentKindEnum.PAGE) {
			return null;
		}
		if (!document.contentJson && !document.contentHtml && !document.contentBinary) {
			return null;
		}

		const employeeId = RequestContext.currentEmployeeId();

		// Debounce lookup: latest version by this editor inside the window
		if (!options.force) {
			const { versionDebounceMinutes } = getDocsConfig();
			const windowStart = new Date(Date.now() - versionDebounceMinutes * 60 * 1000);
			const recent = await this.typeOrmDocumentVersionRepository.findOne({
				where: {
					documentId: document.id,
					tenantId: document.tenantId,
					organizationId: document.organizationId,
					createdById: employeeId ? employeeId : IsNull(),
					lastSavedAt: MoreThan(windowStart)
				},
				order: { lastSavedAt: 'DESC' }
			});
			if (recent) {
				return null; // The autosave stream rolls up into the previous snapshot
			}
		}

		// Capture the pre-update content
		const version = await this.create({
			tenantId: document.tenantId,
			organizationId: document.organizationId,
			documentId: document.id,
			name: document.name,
			contentJson: document.contentJson ?? null,
			contentHtml: document.contentHtml ?? null,
			contentBinary: document.contentBinary ?? null,
			lastSavedAt: new Date(),
			createdById: employeeId ?? null
		});

		// Increment the document's version counter with the capture (in-memory too, so a
		// subsequent entity save by the caller writes the fresh counter, not a stale one)
		document.version = (document.version ?? 1) + 1;
		await this.typeOrmDocumentRepository.update(
			{ id: document.id, tenantId: document.tenantId },
			{ version: document.version }
		);

		return version;
	}

	/**
	 * Paginated version history for a document, newest first. The list projection returns
	 * `id, name, lastSavedAt, createdById` — never content columns.
	 *
	 * @param document The scoped parent document.
	 * @param params Pagination params.
	 * @returns Paginated version list projections.
	 */
	async getVersions(
		document: Document,
		// Only the paging half is consumed — the `where` is built below from the scoped document, so
		// this deliberately does not ask for a full `BaseQueryDTO` (whose `where` is `@IsNotEmpty()`
		// and made the route 400 on every call).
		params: Pick<BaseQueryDTO<DocumentVersion>, 'take' | 'skip'>
	): Promise<IPagination<DocumentVersion>> {
		return this.findAll({
			select: {
				id: true,
				name: true,
				lastSavedAt: true,
				createdById: true,
				createdAt: true,
				updatedAt: true,
				documentId: true
			},
			where: {
				documentId: document.id,
				tenantId: document.tenantId,
				organizationId: document.organizationId
			},
			order: { lastSavedAt: 'DESC' },
			take: params?.take,
			skip: params?.take && params?.skip ? params.take * (params.skip - 1) : undefined
		});
	}

	/**
	 * Loads one full snapshot (incl. content columns) of a document.
	 *
	 * @param document The scoped parent document.
	 * @param versionId The version id.
	 * @returns The full snapshot.
	 */
	async getVersion(document: Document, versionId: ID): Promise<DocumentVersion> {
		const version = await this.typeOrmDocumentVersionRepository.findOne({
			where: {
				id: versionId,
				documentId: document.id,
				tenantId: document.tenantId,
				organizationId: document.organizationId
			}
		});
		if (!version) {
			throw new NotFoundException(`Document version ${versionId} was not found`);
		}
		return version;
	}

	/**
	 * **Non-destructive** restore: first snapshots the current content as a new version (debounce
	 * bypassed), then copies the target snapshot's content onto the document.
	 *
	 * @param document The scoped parent document (must be an unlocked PAGE).
	 * @param versionId The version to restore.
	 * @returns The updated document.
	 */
	async restoreVersion(document: Document, versionId: ID): Promise<Document> {
		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({ message: 'Versions apply to PAGE documents only', code: DOCS_NOT_A_PAGE });
		}
		if (document.isLocked) {
			throw new HttpException({ message: 'Document is locked', code: DOCS_LOCKED }, HttpStatus.LOCKED);
		}

		const version = await this.getVersion(document, versionId);

		// Snapshot the current content first — restore never destroys history
		await this.captureSnapshotIfNeeded(document, { force: true });

		// Copy the target snapshot onto the document (entity save so subscribers run — SQLite JSON)
		document.name = version.name;
		document.contentJson = version.contentJson ?? null;
		document.contentHtml = version.contentHtml ?? null;
		document.contentBinary = version.contentBinary ?? null;
		const restored = await this.typeOrmDocumentRepository.save(document);

		this.logger.log(`Restored document ${document.id} to version ${versionId}`);
		return restored;
	}
}
