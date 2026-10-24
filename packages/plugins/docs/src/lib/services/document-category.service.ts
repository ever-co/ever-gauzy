import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, RequestContext, TenantAwareCrudService, prepareSQLQuery as p } from '@gauzy/core';
import { DOCS_CATEGORY_EXISTS, DOCS_CATEGORY_SYSTEM } from '../docs.constants';
import { CreateDocumentCategoryDTO, UpdateDocumentCategoryDTO } from '../dto';
import { DocumentCategory } from '../entities/document-category.entity';
import { MikroOrmDocumentCategoryRepository } from '../repositories/mikro-orm-document-category.repository';
import { TypeOrmDocumentCategoryRepository } from '../repositories/type-orm-document-category.repository';

@Injectable()
export class DocumentCategoryService extends TenantAwareCrudService<DocumentCategory> {
	private readonly logger = new Logger(DocumentCategoryService.name);

	constructor(
		public readonly typeOrmDocumentCategoryRepository: TypeOrmDocumentCategoryRepository,
		public readonly mikroOrmDocumentCategoryRepository: MikroOrmDocumentCategoryRepository
	) {
		super(typeOrmDocumentCategoryRepository, mikroOrmDocumentCategoryRepository);
	}

	/**
	 * The category service keeps every caller inside the platform's organization boundary.
	 *
	 * `TenantAwareCrudService` used to narrow its read by id to the caller's tenant only, and update, merge and delete
	 * all start from it, so a caller of one organization renamed, merged (re-pointing its documents' assignments) and
	 * deleted another organization's categories by naming their ids.
	 *
	 * The rule is the platform's, applied by the base: a tenant admin reaches every organization of the tenant; anyone
	 * else only the organization of their token, and the categories stored without one. A category outside the
	 * boundary is answered as a missing row by every read of the base, and no write reaches it. The hand-written queries
	 * below keep to the same boundary (`insideOrganizationBoundary`). A request with no signed-in caller (a job, the
	 * seeder) is not confined.
	 *
	 * @returns True: the category service keeps every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}

	/**
	 * Lists the per-tenant/org category catalog, sorted by name, each item carrying
	 * `documentCount`.
	 *
	 * @param params Pagination + org scope.
	 * @returns The catalog page.
	 */
	async getCategories(params: BaseQueryDTO<DocumentCategory>): Promise<IPagination<DocumentCategory>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = (params as any)?.organizationId ?? (params?.where as any)?.organizationId;

		const qb = this.typeOrmRepository.createQueryBuilder('category');
		qb.where(p(`"category"."tenantId" = :tenantId`), { tenantId });
		if (organizationId) {
			qb.andWhere(p(`"category"."organizationId" = :organizationId`), { organizationId });
		}
		this.insideOrganizationBoundary(qb);
		qb.addSelect(
			p(
				`(SELECT COUNT(*) FROM "document_category_document" "dcd" WHERE "dcd"."documentCategoryId" = "category"."id")`
			),
			'category_documentCount'
		);
		qb.orderBy('category.name', 'ASC');
		if (params?.take) {
			qb.take(params.take);
			if (params?.skip) {
				qb.skip(params.take * (params.skip - 1));
			}
		}

		const total = await qb.getCount();
		const { entities, raw } = await qb.getRawAndEntities();
		const items = entities.map((entity: DocumentCategory, index: number) => {
			(entity as any).documentCount = Number(raw[index]?.['category_documentCount']) || 0;
			return entity;
		});

		return { items, total };
	}

	/**
	 * Creates a catalog entry. Names are unique per organization (case-insensitive);
	 * duplicates raise 409 `DOCS_CATEGORY_EXISTS`. The slug is auto-derived when absent.
	 *
	 * @param input The create payload.
	 * @returns The created category.
	 */
	async createCategory(input: CreateDocumentCategoryDTO): Promise<DocumentCategory> {
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = input;
		const slug = input.slug ?? this.slugify(input.name);

		await this.assertUnique(input.name, slug, tenantId, organizationId);

		return this.create({
			...input,
			slug,
			isSystem: false
		});
	}

	/**
	 * Updates a catalog entry. `isSystem` rows may be renamed/recolored but their `slug` is
	 * immutable.
	 *
	 * @param id The category id.
	 * @param input The update payload.
	 * @returns The updated category.
	 */
	async updateCategory(id: ID, input: UpdateDocumentCategoryDTO): Promise<DocumentCategory> {
		const category = await this.findOneByIdString(id);

		const slug = this.resolveUpdatedSlug(category, input);
		if (input.name && input.name.toLowerCase() !== category.name.toLowerCase()) {
			await this.assertUnique(input.name, slug !== category.slug ? slug : undefined, category.tenantId, category.organizationId);
		}

		return this.save({
			...category,
			...input,
			slug,
			id: category.id,
			isSystem: category.isSystem
		});
	}

	/**
	 * Deletes a catalog entry. `isSystem: true` rows raise 409 `DOCS_CATEGORY_SYSTEM`; in-use
	 * categories are detached from documents (pivot rows removed), then soft-deleted.
	 *
	 * @param id The category id.
	 * @returns The soft-deleted category.
	 */
	async deleteCategory(id: ID): Promise<DocumentCategory> {
		const category = await this.findOneByIdString(id);
		if (category.isSystem) {
			throw new ConflictException({ message: 'System categories cannot be deleted', code: DOCS_CATEGORY_SYSTEM });
		}

		// Detach from all documents (pivot rows only, never documents)
		await this.typeOrmRepository.manager
			.createQueryBuilder()
			.delete()
			.from('document_category_document')
			.where(p('"documentCategoryId" = :id'), { id: category.id })
			.execute();

		await this.softDelete(category.id);
		return category;
	}

	/**
	 * Merges this category into `targetId`: re-points all document assignments (deduplicated),
	 * then soft-deletes the source. Self-merge raises 400.
	 *
	 * @param id The source category id.
	 * @param targetId The surviving category id.
	 * @returns The surviving category.
	 */
	async mergeCategory(id: ID, targetId: ID): Promise<DocumentCategory> {
		if (id === targetId) {
			throw new BadRequestException('A category cannot be merged into itself');
		}
		const source = await this.findOneByIdString(id);
		const target = await this.findOneByIdString(targetId);
		if (!target) {
			throw new NotFoundException(`Document category ${targetId} was not found`);
		}
		// A category is a catalog entry of one organization: merging across two would hand one organization's document
		// assignments to the other's catalog.
		if (String(source.organizationId ?? '') !== String(target.organizationId ?? '')) {
			throw new BadRequestException('A category can only be merged into a category of the same organization');
		}

		const manager = this.typeOrmRepository.manager;

		// Re-point assignments that do not already exist on the target (deduplicated)
		const sourceRows: Array<{ documentId: ID }> = await manager
			.createQueryBuilder()
			.select(p('"pivot"."documentId"'), 'documentId')
			.from('document_category_document', 'pivot')
			.where(p('"pivot"."documentCategoryId" = :sourceId'), { sourceId: source.id })
			.getRawMany();
		const targetRows: Array<{ documentId: ID }> = await manager
			.createQueryBuilder()
			.select(p('"pivot"."documentId"'), 'documentId')
			.from('document_category_document', 'pivot')
			.where(p('"pivot"."documentCategoryId" = :targetId'), { targetId: target.id })
			.getRawMany();
		const alreadyAssigned = new Set(targetRows.map((row) => row.documentId));
		const toInsert = sourceRows
			.map((row) => row.documentId)
			.filter((documentId) => !alreadyAssigned.has(documentId));

		if (toInsert.length > 0) {
			await manager
				.createQueryBuilder()
				.insert()
				.into('document_category_document', ['documentId', 'documentCategoryId'])
				.values(toInsert.map((documentId) => ({ documentId, documentCategoryId: target.id })))
				.execute();
		}
		await manager
			.createQueryBuilder()
			.delete()
			.from('document_category_document')
			.where(p('"documentCategoryId" = :sourceId'), { sourceId: source.id })
			.execute();

		await this.softDelete(source.id);
		this.logger.log(`Merged document category ${source.id} into ${target.id}`);
		return target;
	}

	/**
	 * Resolves the slug an update should persist:
	 * - `isSystem` rows keep their slug — it is immutable;
	 * - an explicitly supplied `slug` wins (including an empty string — only `null`/`undefined`
	 *   count as "not supplied");
	 * - otherwise a renamed category re-derives its slug from the new name;
	 * - a category that is neither re-slugged nor renamed keeps the stored slug.
	 *
	 * @param category The stored category.
	 * @param input The update payload.
	 * @returns The slug to persist.
	 */
	private resolveUpdatedSlug(category: DocumentCategory, input: UpdateDocumentCategoryDTO): string {
		if (category.isSystem) {
			return category.slug;
		}
		if (input.slug !== null && input.slug !== undefined) {
			return input.slug;
		}
		return input.name ? this.slugify(input.name) : category.slug;
	}

	/**
	 * Case-insensitive name + slug uniqueness probe; violations raise 409 `DOCS_CATEGORY_EXISTS`.
	 */
	private async assertUnique(name: string, slug: string | undefined, tenantId: ID, organizationId: ID): Promise<void> {
		const qb = this.typeOrmRepository.createQueryBuilder('category');
		qb.where(p(`"category"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"category"."organizationId" = :organizationId`), { organizationId });
		this.insideOrganizationBoundary(qb);
		if (slug) {
			qb.andWhere(p(`(LOWER("category"."name") = :name OR "category"."slug" = :slug)`), {
				name: name.toLowerCase(),
				slug
			});
		} else {
			qb.andWhere(p(`LOWER("category"."name") = :name`), { name: name.toLowerCase() });
		}
		const existing = await qb.getOne();
		if (existing) {
			throw new ConflictException({
				message: `A category named '${name}' already exists`,
				code: DOCS_CATEGORY_EXISTS
			});
		}
	}

	/**
	 * Keeps a hand-written query on the category table inside the caller's organization boundary, which the base keeps
	 * its own reads to and a query builder does not reach: a caller confined to their organization reads its categories
	 * and the tenant's own (no organization), whatever organization the query states; a tenant admin, and a request with
	 * no signed-in caller, read every organization's.
	 *
	 * @param qb The query, on the alias `category`.
	 */
	private insideOrganizationBoundary(qb: SelectQueryBuilder<DocumentCategory>): void {
		const boundary = this.organizationBoundary();
		if (!boundary) {
			return;
		}
		if (boundary.organizationId) {
			qb.andWhere(
				p(`("category"."organizationId" = :boundaryOrganizationId OR "category"."organizationId" IS NULL)`),
				{ boundaryOrganizationId: boundary.organizationId }
			);
		} else {
			qb.andWhere(p(`"category"."organizationId" IS NULL`));
		}
	}

	/**
	 * Derives a kebab-case slug from a display name.
	 */
	private slugify(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)+/g, '');
	}
}
