import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

		const slug = category.isSystem ? category.slug : input.slug ?? (input.name ? this.slugify(input.name) : category.slug);
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
			.where('"documentCategoryId" = :id', { id: category.id })
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

		const manager = this.typeOrmRepository.manager;

		// Re-point assignments that do not already exist on the target (deduplicated)
		const sourceRows: Array<{ documentId: ID }> = await manager
			.createQueryBuilder()
			.select('"pivot"."documentId"', 'documentId')
			.from('document_category_document', 'pivot')
			.where('"pivot"."documentCategoryId" = :sourceId', { sourceId: source.id })
			.getRawMany();
		const targetRows: Array<{ documentId: ID }> = await manager
			.createQueryBuilder()
			.select('"pivot"."documentId"', 'documentId')
			.from('document_category_document', 'pivot')
			.where('"pivot"."documentCategoryId" = :targetId', { targetId: target.id })
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
			.where('"documentCategoryId" = :sourceId', { sourceId: source.id })
			.execute();

		await this.softDelete(source.id);
		this.logger.log(`Merged document category ${source.id} into ${target.id}`);
		return target;
	}

	/**
	 * Case-insensitive name + slug uniqueness probe; violations raise 409 `DOCS_CATEGORY_EXISTS`.
	 */
	private async assertUnique(name: string, slug: string | undefined, tenantId: ID, organizationId: ID): Promise<void> {
		const qb = this.typeOrmRepository.createQueryBuilder('category');
		qb.where(p(`"category"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"category"."organizationId" = :organizationId`), { organizationId });
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
