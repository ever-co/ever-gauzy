import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common';
import { Brackets, FindOneOptions, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import {
	BaseEntityEnum,
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	ID,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	EventBus,
	FavoriteService,
	RequestContext,
	TenantAwareCrudService,
	prepareSQLQuery as p,
	sanitizeRichHtml
} from '@gauzy/core';
import {
	DOCS_CONTENT_CONFLICT,
	DOCS_FILE_VIA_UPLOAD,
	DOCS_LOCKED,
	DOCS_NOT_A_PAGE,
	DOCS_ORGANIZATION_REQUIRED,
	DOCS_PARENT_NOT_CONTAINER,
	DOCS_QUERY_TOO_SHORT,
	DOCS_SOURCE_RESERVED,
	DOCS_WRITE_FORBIDDEN
} from '../docs.constants';
import { CreateDocumentDTO, GetDocumentsQueryDTO, UpdateDocumentContentDTO, UpdateDocumentDTO } from '../dto';
import { Document } from '../entities/document.entity';
import { DocumentEvent, IDocumentEventContext } from '../events/document.event';
import { MikroOrmDocumentRepository } from '../repositories/mikro-orm-document.repository';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentAccessService } from './document-access.service';
import { DocumentVersionService } from './document-version.service';

/**
 * Columns safe for list projections — the content columns (`contentJson`, `contentHtml`,
 * `contentBinary`, `extractedText`) are never selected by list/facet queries.
 */
export const DOCUMENT_LIST_COLUMNS = [
	'id',
	'createdAt',
	'updatedAt',
	'createdByUserId',
	'isActive',
	'isArchived',
	'archivedAt',
	'tenantId',
	'organizationId',
	'kind',
	'parentId',
	'index',
	'name',
	'icon',
	'color',
	'description',
	'isLocked',
	'mimeType',
	'fileSize',
	'sha256',
	'originalFilename',
	'version',
	'extractedTextEdited',
	'summary',
	'status',
	'statusMessage',
	'source',
	'knowledgeStatus',
	'aiConfidence',
	'searchable',
	'reviewStatus',
	'reviewReason',
	'reviewedById',
	'reviewedAt',
	'visibility',
	'externalSource',
	'externalId'
];

@FavoriteService(BaseEntityEnum.Document)
@Injectable()
export class DocumentService extends TenantAwareCrudService<Document> {
	private readonly logger = new Logger(DocumentService.name);

	constructor(
		public readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		public readonly mikroOrmDocumentRepository: MikroOrmDocumentRepository,
		private readonly documentVersionService: DocumentVersionService,
		private readonly documentAccessService: DocumentAccessService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmDocumentRepository, mikroOrmDocumentRepository);
	}

	/**
	 * Applies the Documents visibility + share composition rule to a query builder
	 * (`08-permissions-security.md` §3.4): `PRIVATE` rows are visible only to their creator,
	 * to holders of `DOCS_MANAGE`, and to `DocumentShare` grantees (employee grant, or a team
	 * the requester currently belongs to — resolved in the same SQL predicate so lists,
	 * facets, tree browsing and retrieval stay single-query and consistent).
	 *
	 * The route guard has already proven `DOCS_READ`; this method adds the row-level half of
	 * `permission AND (visibility OR ownership OR adminOverride OR share)`.
	 *
	 * @param qb The query (or where expression) builder to scope.
	 * @param alias The `document` alias in the query.
	 */
	public applyVisibilityScope(qb: WhereExpressionBuilder, alias = 'document'): void {
		if (RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE)) {
			return; // Admins see everything in their tenant/org scope
		}
		const userId = RequestContext.currentUserId();
		qb.andWhere(
			new Brackets((web: WhereExpressionBuilder) => {
				web.where(p(`"${alias}"."visibility" = :organizationVisibility`), {
					organizationVisibility: DocumentVisibilityEnum.ORGANIZATION
				});
				if (userId) {
					web.orWhere(p(`"${alias}"."createdByUserId" = :visibilityUserId`), { visibilityUserId: userId });
				}
				// Additive share overlay — never subtracts rights, no-op without an employee identity.
				this.documentAccessService.applyShareScope(web, alias);
			})
		);
	}

	/**
	 * Resolves the organization scope of a request: the explicit payload value first, then the
	 * `where` envelope of the query DTOs, then the requester's current organization.
	 *
	 * `whitelist: true` strips any property the DTO does not declare, so a filter set can reach
	 * the service with no `organizationId` at all — falling back to "no organization filter"
	 * would list the whole tenant, so an unresolvable scope is a hard 400 instead.
	 *
	 * @param params An optional payload carrying an organization scope.
	 * @returns The resolved organization id.
	 */
	public resolveOrganizationId(params?: { organizationId?: ID; where?: { organizationId?: ID } }): ID {
		const organizationId =
			(params as any)?.organizationId ??
			(params?.where as any)?.organizationId ??
			RequestContext.currentOrganizationId();
		if (!organizationId) {
			throw new BadRequestException({
				message: 'An organization scope is required for this request',
				code: DOCS_ORGANIZATION_REQUIRED
			});
		}
		return organizationId;
	}

	/**
	 * Loads a document by id within the caller's tenant/organization + visibility scope
	 * (visibility OR ownership OR `DOCS_MANAGE` OR a share grant, per §3.4).
	 * A cross-tenant, cross-org, or invisible id resolves to 404, never 403 (no existence oracle).
	 *
	 * The tenant + organization pair is applied explicitly here: the inherited
	 * `findOneByIdString` merges the **tenant only**, which would otherwise resolve any
	 * organization's document inside the tenant.
	 *
	 * @param id The document id.
	 * @param relations Optional relations to join.
	 * @returns The scoped document entity.
	 */
	async findOneScoped(id: ID, relations: string[] = []): Promise<Document> {
		return this.findOneWithinScope(id, { relations });
	}

	/**
	 * Same scope as `findOneScoped`, but soft-deleted rows are visible — the recovery path
	 * needs the trashed row and must not be able to reach another organization's trash.
	 *
	 * @param id The document id.
	 * @returns The scoped (possibly soft-deleted) document entity.
	 */
	async findOneDeletedScoped(id: ID): Promise<Document> {
		return this.findOneWithinScope(id, { withDeleted: true });
	}

	/**
	 * Asserts that the requester may MUTATE the given row (§1.6 ownership + the `EDIT` share
	 * level). The route guard only proves the verb permission — this adds the row-level half,
	 * so a `VIEW`/`COMMENT` grantee can read a shared document but never write it.
	 *
	 * @param document The document about to be mutated.
	 */
	public async assertCanWrite(document: Document): Promise<void> {
		const permitted = await this.documentAccessService.canWrite(
			{
				createdByUserId: document.createdByUserId,
				visibility: document.visibility,
				isLocked: document.isLocked
			},
			document.id
		);
		if (!permitted) {
			throw new ForbiddenException({
				message: 'You do not have write access to this document',
				code: DOCS_WRITE_FORBIDDEN
			});
		}
	}

	/**
	 * The shared tenant + organization + visibility resolution behind `findOneScoped` and
	 * `findOneDeletedScoped`.
	 */
	private async findOneWithinScope(
		id: ID,
		options: { relations?: string[]; withDeleted?: boolean } = {}
	): Promise<Document> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = this.resolveOrganizationId();

		const document = await this.typeOrmRepository.findOne({
			where: { id, tenantId, organizationId },
			...(options.relations?.length ? { relations: options.relations } : {}),
			...(options.withDeleted ? { withDeleted: true } : {})
		} as FindOneOptions<Document>);
		if (!document) {
			throw new NotFoundException(`Document ${id} was not found`);
		}

		if (
			document.visibility === DocumentVisibilityEnum.PRIVATE &&
			!RequestContext.hasPermission(PermissionsEnum.DOCS_MANAGE) &&
			document.createdByUserId !== RequestContext.currentUserId()
		) {
			// Last gate: the share overlay. Only reached for someone else's PRIVATE document,
			// so the extra lookup never touches the common read paths.
			const shared = await this.documentAccessService.canRead(
				{ createdByUserId: document.createdByUserId, visibility: document.visibility },
				document.id
			);
			if (!shared) {
				throw new NotFoundException(`Document ${id} was not found`);
			}
		}
		return document;
	}

	/**
	 * Creates a FOLDER or PAGE node (`kind: FILE` enters through the upload endpoint).
	 *
	 * @param input The create payload.
	 * @returns The created document.
	 */
	async createDocument(input: CreateDocumentDTO): Promise<Document> {
		if (input.kind === DocumentKindEnum.FILE) {
			throw new BadRequestException({
				message: 'FILE documents are created through the upload endpoint',
				code: DOCS_FILE_VIA_UPLOAD
			});
		}

		// Reserved sources (`SYSTEM`, `IMPORT`) can never be claimed by this endpoint —
		// FOLDER/PAGE nodes authored in the platform are always `EDITOR`.
		if (
			(input as any).source &&
			[DocumentSourceEnum.SYSTEM, DocumentSourceEnum.IMPORT].includes((input as any).source)
		) {
			throw new BadRequestException({ message: 'Reserved source', code: DOCS_SOURCE_RESERVED });
		}
		const source = DocumentSourceEnum.EDITOR;

		// The parent must be a container (FOLDER or PAGE)
		if (input.parentId) {
			const parent = await this.findOneScoped(input.parentId);
			if (parent.kind === DocumentKindEnum.FILE) {
				throw new BadRequestException({
					message: 'A FILE document can never be a parent',
					code: DOCS_PARENT_NOT_CONTAINER
				});
			}
		}

		const document = await this.create({
			...this.buildAssignableFields(input),
			kind: input.kind,
			contentJson: input.contentJson ?? null,
			contentHtml: input.contentHtml ? this.sanitizeHtml(input.contentHtml) : null,
			status: DocumentStatusEnum.READY,
			source,
			knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
			reviewStatus: DocumentReviewStatusEnum.NONE,
			visibility: input.visibility ?? DocumentVisibilityEnum.ORGANIZATION
		});

		this.emitDocumentEvent(document, 'created', { phase: 'crud' }, input);
		return document;
	}

	/**
	 * Partial metadata-only update (name/icon/color/description/flags, categories/tags, visibility).
	 * Content saves go through `updateContent`.
	 *
	 * @param id The document id.
	 * @param input The update payload.
	 * @returns The updated document.
	 */
	async updateDocument(id: ID, input: UpdateDocumentDTO): Promise<Document> {
		const document = await this.findOneScoped(id);
		await this.assertCanWrite(document);

		const updated = await this.save({
			...document,
			...this.buildAssignableFields(input),
			id: document.id
		});

		this.emitDocumentEvent(updated, 'updated', { phase: 'crud' }, input);
		return updated;
	}

	/**
	 * PAGE content save with optimistic concurrency, lock enforcement, debounced version
	 * snapshot, and mention diff-sync.
	 *
	 * @param id The PAGE document id.
	 * @param input The content payload.
	 * @returns The updated document.
	 */
	async updateContent(id: ID, input: UpdateDocumentContentDTO): Promise<Document> {
		const document = await this.findOneScoped(id);
		await this.assertCanWrite(document);

		if (document.kind !== DocumentKindEnum.PAGE) {
			throw new ConflictException({ message: 'Content saves apply to PAGE documents only', code: DOCS_NOT_A_PAGE });
		}

		// 423 Locked — a locked page is view-only until unlocked
		if (document.isLocked) {
			throw new HttpException({ message: 'Document is locked', code: DOCS_LOCKED }, HttpStatus.LOCKED);
		}

		// 409 optimistic-concurrency conflict on a stale editor
		const currentUpdatedAt = new Date(document.updatedAt).getTime();
		const expectedUpdatedAt = new Date(input.expectedUpdatedAt).getTime();
		if (Number.isFinite(expectedUpdatedAt) && expectedUpdatedAt !== currentUpdatedAt) {
			throw new ConflictException({
				message: 'Document content changed since it was loaded',
				code: DOCS_CONTENT_CONFLICT,
				currentUpdatedAt: document.updatedAt
			});
		}

		// Debounced pre-update snapshot (bypassed with forceSnapshot)
		await this.documentVersionService.captureSnapshotIfNeeded(document, {
			force: input.forceSnapshot === true
		});

		const updated = await this.save({
			...document,
			id: document.id,
			contentJson: input.contentJson,
			contentHtml: input.contentHtml ? this.sanitizeHtml(input.contentHtml) : document.contentHtml
		});

		// Mention diff-sync on content save.
		// NOTE: `MentionService` is not part of the public `@gauzy/core` API surface yet — once it
		// is exported, wire `updateEntityMentions(BaseEntityEnum.Document, id, mentionEmployeeIds)`
		// here. Best-effort by contract: a failure must never roll back the content save.
		if (Array.isArray(input.mentionEmployeeIds)) {
			this.logger.debug(`Mention sync requested for document ${id} (${input.mentionEmployeeIds.length} ids)`);
		}

		this.emitDocumentEvent(updated, 'updated', { phase: 'crud' }, input as any);
		return updated;
	}

	/**
	 * Paginated, filtered document list. List projections never select content columns; the
	 * items carry `hasContent`, `hasExtractedText`, `hasChildren` and `childrenCount` instead.
	 *
	 * @param params The filter set.
	 * @returns Paginated documents.
	 */
	async getDocuments(params: GetDocumentsQueryDTO): Promise<IPagination<Document>> {
		const qb = this.buildFilteredQuery(params);

		// Safe projection + boolean content markers
		qb.select(DOCUMENT_LIST_COLUMNS.map((column) => `document.${column}`));
		qb.addSelect(p(`CASE WHEN "document"."contentJson" IS NOT NULL THEN 1 ELSE 0 END`), 'document_hasContent');
		qb.addSelect(
			p(`CASE WHEN "document"."extractedText" IS NOT NULL THEN 1 ELSE 0 END`),
			'document_hasExtractedText'
		);
		qb.addSelect(
			p(
				`(SELECT COUNT(*) FROM "document" "child" WHERE "child"."parentId" = "document"."id" AND "child"."deletedAt" IS NULL)`
			),
			'document_childrenCount'
		);

		// Sorting
		const order = params.sortOrder === 'ASC' ? 'ASC' : params.sortOrder === 'DESC' ? 'DESC' : undefined;
		if (params.sort) {
			const sortColumn = params.sort === 'size' ? 'fileSize' : params.sort;
			qb.orderBy(`document.${sortColumn}`, order ?? 'ASC');
		} else if (params.parentId) {
			qb.orderBy('document.index', 'ASC'); // tree browse default
		} else {
			qb.orderBy('document.updatedAt', 'DESC'); // list default
		}

		// Pagination
		if (params.take) {
			qb.take(params.take);
		}
		if (params.skip) {
			qb.skip(params.take ? params.take * (params.skip - 1) : params.skip);
		}

		const total = await qb.getCount();
		const { entities, raw } = await qb.getRawAndEntities();

		// Attach the computed list markers to the (non-persisted) entity fields
		const items = entities.map((entity: Document, index: number) => {
			const rawRow = raw[index] ?? {};
			(entity as any).hasContent = Number(rawRow['document_hasContent']) === 1;
			(entity as any).hasExtractedText = Number(rawRow['document_hasExtractedText']) === 1;
			(entity as any).childrenCount = Number(rawRow['document_childrenCount']) || 0;
			(entity as any).hasChildren = Number(rawRow['document_childrenCount']) > 0;
			return entity;
		});

		return { items, total };
	}

	/**
	 * Count for the same filter set as `getDocuments`.
	 *
	 * @param params The filter set.
	 * @returns The matching row count.
	 */
	async getDocumentCount(params: GetDocumentsQueryDTO): Promise<number> {
		return this.buildFilteredQuery(params).getCount();
	}

	/**
	 * Facet counts for the filter chips. Every facet bucket is computed over the *other*
	 * filters, so each chip shows what its selection would yield.
	 *
	 * @param params The filter set.
	 * @returns The facet-count envelope.
	 */
	async getDocumentFacets(params: GetDocumentsQueryDTO): Promise<Record<string, any>> {
		const facetOf = async (column: string, omit: keyof GetDocumentsQueryDTO): Promise<Record<string, number>> => {
			const facetParams = { ...params, [omit]: undefined } as GetDocumentsQueryDTO;
			const rows = await this.buildFilteredQuery(facetParams)
				.select(`document.${column}`, 'value')
				.addSelect('COUNT(*)', 'count')
				.groupBy(`document.${column}`)
				.getRawMany();
			return rows.reduce((acc: Record<string, number>, row: any) => {
				if (row.value !== null && row.value !== undefined) {
					acc[row.value] = Number(row.count);
				}
				return acc;
			}, {});
		};

		const [kind, status, knowledgeStatus, reviewStatus, source] = await Promise.all([
			facetOf('kind', 'kind'),
			facetOf('status', 'status'),
			facetOf('knowledgeStatus', 'knowledgeStatus'),
			facetOf('reviewStatus', 'reviewStatus'),
			facetOf('source', 'source')
		]);

		// Category + tag facets group over the pivots joined to the filtered document set
		const categories = await this.buildFilteredQuery({ ...params, categoryIds: undefined } as GetDocumentsQueryDTO)
			.innerJoin('document.categories', 'facetCategory')
			.select('facetCategory.id', 'id')
			.addSelect('facetCategory.name', 'name')
			.addSelect('COUNT(*)', 'count')
			.groupBy('facetCategory.id')
			.addGroupBy('facetCategory.name')
			.getRawMany();

		const tags = await this.buildFilteredQuery({ ...params, tagIds: undefined } as GetDocumentsQueryDTO)
			.innerJoin('document.tags', 'facetTag')
			.select('facetTag.id', 'id')
			.addSelect('facetTag.name', 'name')
			.addSelect('COUNT(*)', 'count')
			.groupBy('facetTag.id')
			.addGroupBy('facetTag.name')
			.getRawMany();

		// Preset chips
		const [all, needsReview, notInKnowledge, archived] = await Promise.all([
			this.buildFilteredQuery(params).getCount(),
			this.buildFilteredQuery({
				...params,
				reviewStatus: [DocumentReviewStatusEnum.PENDING],
				needsReview: undefined
			} as GetDocumentsQueryDTO).getCount(),
			this.buildFilteredQuery({
				...params,
				knowledgeStatus: [DocumentKnowledgeStatusEnum.NONE, DocumentKnowledgeStatusEnum.EXCLUDED]
			} as GetDocumentsQueryDTO).getCount(),
			this.buildFilteredQuery({ ...params, archived: 'only' } as GetDocumentsQueryDTO).getCount()
		]);

		return {
			kind,
			status,
			knowledgeStatus,
			reviewStatus,
			source,
			categories: categories.map((row: any) => ({ id: row.id, name: row.name, count: Number(row.count) })),
			tags: tags.map((row: any) => ({ id: row.id, name: row.name, count: Number(row.count) })),
			presets: { all, needsReview, notInKnowledge, archived }
		};
	}

	/**
	 * Publishes a `DocumentEvent` on the core RxJS event bus. Best-effort: a failure logs and
	 * never rolls back the primary mutation.
	 *
	 * Activity-log + entity-subscription publication rides the same seam.
	 * NOTE: `ActivityLogService` / `CreateEntitySubscriptionEvent` are not part of the public
	 * `@gauzy/core` API surface yet — wire `logActivity<Document>(...)` and the subscription
	 * event here as soon as the core barrel exports them.
	 *
	 * @param entity The document the event describes.
	 * @param type The CRUD event type.
	 * @param context The lifecycle phase context.
	 * @param input Optional input payload.
	 */
	public emitDocumentEvent(
		entity: Document,
		type: 'created' | 'updated' | 'deleted',
		context: IDocumentEventContext = { phase: 'crud' },
		input?: any
	): void {
		try {
			const ctx = RequestContext.currentRequestContext();
			this._eventBus.publish(new DocumentEvent(ctx, entity, type, context, input));
		} catch (error) {
			this.logger.warn(`Failed to publish DocumentEvent (${type}): ${(error as Error).message}`);
		}
	}

	/**
	 * Builds the shared filtered query for list/count/facets — tenant + organization scope,
	 * visibility scope, soft-delete filter (implicit), and every filter of the DTO.
	 *
	 * @param params The filter set.
	 * @returns A scoped `SelectQueryBuilder`.
	 */
	private buildFilteredQuery(params: GetDocumentsQueryDTO): SelectQueryBuilder<Document> {
		const tenantId = RequestContext.currentTenantId();
		// NEVER optional: `whitelist: true` strips an unexpected `organizationId` off the query
		// DTO, so a missing scope must fall back to the request context (or 400) — treating it
		// as "no filter" would list every organization of the tenant.
		const organizationId = this.resolveOrganizationId(params as any);

		const qb = this.typeOrmRepository.createQueryBuilder('document');
		qb.where(p(`"document"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"document"."organizationId" = :organizationId`), { organizationId });

		this.applyVisibilityScope(qb);

		// Archived handling (default exclude)
		const archived = params.archived ?? 'exclude';
		if (archived === 'exclude') {
			qb.andWhere(p(`"document"."isArchived" = :isArchived`), { isArchived: false });
		} else if (archived === 'only') {
			qb.andWhere(p(`"document"."isArchived" = :isArchived`), { isArchived: true });
		}

		if (params.kind) {
			qb.andWhere(p(`"document"."kind" = :kind`), { kind: params.kind });
		}
		if (params.status?.length) {
			qb.andWhere(p(`"document"."status" IN (:...statuses)`), { statuses: params.status });
		}
		if (params.knowledgeStatus?.length) {
			qb.andWhere(p(`"document"."knowledgeStatus" IN (:...knowledgeStatuses)`), {
				knowledgeStatuses: params.knowledgeStatus
			});
		}
		// needsReview shorthand wins over reviewStatus if both sent
		if (params.needsReview === true) {
			qb.andWhere(p(`"document"."reviewStatus" = :pendingReview`), {
				pendingReview: DocumentReviewStatusEnum.PENDING
			});
		} else if (params.reviewStatus?.length) {
			qb.andWhere(p(`"document"."reviewStatus" IN (:...reviewStatuses)`), { reviewStatuses: params.reviewStatus });
		}
		if (params.source?.length) {
			qb.andWhere(p(`"document"."source" IN (:...sources)`), { sources: params.source });
		}
		if (params.visibility) {
			qb.andWhere(p(`"document"."visibility" = :visibility`), { visibility: params.visibility });
		}
		if (typeof params.searchable === 'boolean') {
			qb.andWhere(p(`"document"."searchable" = :searchableFlag`), { searchableFlag: params.searchable });
		}
		if (params.createdAtFrom) {
			qb.andWhere(p(`"document"."createdAt" >= :createdAtFrom`), { createdAtFrom: params.createdAtFrom });
		}
		if (params.createdAtTo) {
			qb.andWhere(p(`"document"."createdAt" <= :createdAtTo`), {
				createdAtTo: this.endOfDayIfDateOnly(params.createdAtTo)
			});
		}
		if (params.updatedAtFrom) {
			qb.andWhere(p(`"document"."updatedAt" >= :updatedAtFrom`), { updatedAtFrom: params.updatedAtFrom });
		}
		if (params.updatedAtTo) {
			qb.andWhere(p(`"document"."updatedAt" <= :updatedAtTo`), {
				updatedAtTo: this.endOfDayIfDateOnly(params.updatedAtTo)
			});
		}

		// Tree browse vs flat search
		if (params.parentId === 'root') {
			qb.andWhere(p(`"document"."parentId" IS NULL`));
		} else if (params.parentId) {
			qb.andWhere(p(`"document"."parentId" = :parentId`), { parentId: params.parentId });
		}

		// ANY-match M2M filters via pivot EXISTS subqueries
		if (params.categoryIds?.length) {
			qb.andWhere(
				p(
					`EXISTS (SELECT 1 FROM "document_category_document" "dcd" WHERE "dcd"."documentId" = "document"."id" AND "dcd"."documentCategoryId" IN (:...filterCategoryIds))`
				),
				{ filterCategoryIds: params.categoryIds }
			);
		}
		if (params.tagIds?.length) {
			qb.andWhere(
				p(
					`EXISTS (SELECT 1 FROM "tag_document" "td" WHERE "td"."documentId" = "document"."id" AND "td"."tagId" IN (:...filterTagIds))`
				),
				{ filterTagIds: params.tagIds }
			);
		}

		// Name / content search
		if (params.q) {
			if (params.searchIn === 'content') {
				if (params.q.length < 3) {
					throw new BadRequestException({
						message: 'Content search requires at least 3 characters',
						code: DOCS_QUERY_TOO_SHORT
					});
				}
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.where(p(`LOWER("document"."name") LIKE :q`), { q: `%${params.q.toLowerCase()}%` });
						web.orWhere(
							new Brackets((content: WhereExpressionBuilder) => {
								content.where(p(`"document"."searchable" = :contentSearchable`), {
									contentSearchable: true
								});
								content.andWhere(
									new Brackets((cols: WhereExpressionBuilder) => {
										cols.where(p(`LOWER("document"."contentHtml") LIKE :q`), {
											q: `%${params.q.toLowerCase()}%`
										});
										cols.orWhere(p(`LOWER("document"."extractedText") LIKE :q`), {
											q: `%${params.q.toLowerCase()}%`
										});
									})
								);
							})
						);
					})
				);
			} else {
				qb.andWhere(p(`LOWER("document"."name") LIKE :q`), { q: `%${params.q.toLowerCase()}%` });
			}
		}

		return qb;
	}

	/**
	 * Extends a date-only `To` bound to cover the whole day.
	 */
	private endOfDayIfDateOnly(value: string): string {
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
	}

	/**
	 * Maps the writable metadata fields of the create/update DTOs onto entity fields
	 * (including tag/category id arrays → relation stubs).
	 */
	private buildAssignableFields(input: Partial<CreateDocumentDTO> & Partial<UpdateDocumentDTO>): Partial<Document> {
		const fields: Partial<Document> = {};
		if (input.organizationId !== undefined) {
			fields.organizationId = input.organizationId;
		}
		if (input.name !== undefined) {
			fields.name = input.name;
		}
		if (input.parentId !== undefined) {
			fields.parentId = input.parentId;
		}
		if (input.index !== undefined) {
			fields.index = input.index;
		}
		if (input.icon !== undefined) {
			fields.icon = input.icon;
		}
		if (input.color !== undefined) {
			fields.color = input.color;
		}
		if (input.description !== undefined) {
			fields.description = input.description;
		}
		if (input.visibility !== undefined) {
			fields.visibility = input.visibility;
		}
		if ((input as UpdateDocumentDTO).searchable !== undefined) {
			fields.searchable = (input as UpdateDocumentDTO).searchable;
		}
		if ((input as UpdateDocumentDTO).isLocked !== undefined) {
			fields.isLocked = (input as UpdateDocumentDTO).isLocked;
		}
		if ((input as UpdateDocumentDTO).summary !== undefined) {
			fields.summary = (input as UpdateDocumentDTO).summary;
		}
		if (input.categoryIds !== undefined) {
			fields.categories = input.categoryIds.map((id: ID) => ({ id })) as any;
		}
		if (input.tagIds !== undefined) {
			fields.tags = input.tagIds.map((id: ID) => ({ id })) as any;
		}
		return fields;
	}

	/**
	 * Server-side sanitization of the `contentHtml` render cache. Delegates to the shared
	 * **allowlist** sanitizer of `@gauzy/core` (`core/html-sanitizer`) — a denylist of regexes
	 * is bypassable by construction, so the platform keeps exactly one parser-backed
	 * implementation. `contentJson` stays canonical; this cache is regenerated on every save.
	 */
	private sanitizeHtml(html: string): string {
		return sanitizeRichHtml(html);
	}
}
