import { Injectable, BadRequestException } from '@nestjs/common';
import { Brackets, FindOptionsWhere, In, SelectQueryBuilder, WhereExpressionBuilder, DeepPartial } from 'typeorm';
import { RequestContext, TenantAwareCrudService, BaseQueryDTO, prepareSQLQuery as p, LIKE_OPERATOR } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/utils';
import {
	ID,
	IHelpCenterArticle,
	IHelpCenterArticleUpdate,
	IHelpCenterArticleVersion,
	IHelpCenterArticleFiltering,
	IHelpCenterArticleAdvancedFilter,
	IPagination
} from '@gauzy/contracts';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenterArticleVersion } from './help-center-article-version.entity';
import { HelpCenterArticleVersionService } from './help-center-article-version.service';
import { TypeOrmHelpCenterArticleRepository } from './repository/type-orm-help-center-article.repository';
import { MikroOrmHelpCenterArticleRepository } from './repository/mikro-orm-help-center-article.repository';

@Injectable()
export class HelpCenterArticleService extends TenantAwareCrudService<HelpCenterArticle> {
	constructor(
		readonly typeOrmHelpCenterArticleRepository: TypeOrmHelpCenterArticleRepository,
		readonly mikroOrmHelpCenterArticleRepository: MikroOrmHelpCenterArticleRepository,
		private readonly versionService: HelpCenterArticleVersionService
	) {
		super(typeOrmHelpCenterArticleRepository, mikroOrmHelpCenterArticleRepository);
	}

	/**
	 * Get articles by category ID.
	 */
	async getArticlesByCategoryId(categoryId: ID): Promise<HelpCenterArticle[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('knowledge_base_article')
			.where('knowledge_base_article.categoryId = :categoryId', {
				categoryId
			})
			.getMany();
	}

	/**
	 * Get articles by project ID with pagination and advanced filtering.
	 *
	 * @param projectId - The project ID to filter by.
	 * @param options - The pagination and filtering options.
	 * @returns A promise that resolves with the paginated articles and total count.
	 */
	async getArticlesByProjectId(
		projectId: ID,
		options: BaseQueryDTO<HelpCenterArticle> & IHelpCenterArticleFiltering
	): Promise<IPagination<IHelpCenterArticle>> {
		try {
			const { where, filters } = options;
			const { organizationId } = where;
			const tenantId = RequestContext.currentTenantId() ?? where.tenantId;

			// Initialize the query
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.leftJoin(`${query.alias}.projects`, 'projects');

			// Apply find options if provided
			if (isNotEmpty(options)) {
				query.setFindOptions({
					...(options.select && { select: options.select }),
					...(options.relations && { relations: options.relations }),
					...(options.order && { order: options.order }),
					...(options.take && { take: options.take }),
					...(options.skip && { skip: options.skip })
				});
			}

			// Apply advanced filters
			if (filters) {
				const advancedWhere = this.buildAdvancedWhereCondition(filters, where);
				query.setFindOptions({ where: advancedWhere });
			}

			// Filter by knowledge_base_article_project with a sub query
			query.andWhere((qb: SelectQueryBuilder<HelpCenterArticle>) => {
				const subQuery = qb
					.subQuery()
					.select(p('"kbap"."knowledgeBaseArticleId"'))
					.from(p('knowledge_base_article_project'), 'kbap')
					.andWhere(p('"kbap"."organizationProjectId" = :projectId'), { projectId });

				return p(`"knowledge_base_article_projects"."knowledgeBaseArticleId" IN `) + subQuery.distinct(true).getQuery();
			});

			// Add organization and tenant filters
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					qb.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
					qb.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
				})
			);

			// Add additional filters (draft, privacy, names, etc.)
			query.andWhere(
				new Brackets((qb: WhereExpressionBuilder) => {
					if (isNotEmpty(where)) {
						const { name, draft, privacy, isLocked, categoryId } = where;

						if (isNotEmpty(name)) {
							qb.andWhere(p(`"${query.alias}"."name" ${LIKE_OPERATOR} :name`), { name: `%${name}%` });
						}
						if (draft !== undefined) {
							qb.andWhere(p(`"${query.alias}"."draft" = :draft`), { draft });
						}
						if (privacy !== undefined) {
							qb.andWhere(p(`"${query.alias}"."privacy" = :privacy`), { privacy });
						}
						if (isLocked !== undefined) {
							qb.andWhere(p(`"${query.alias}"."isLocked" = :isLocked`), { isLocked });
						}
						if (isNotEmpty(categoryId)) {
							qb.andWhere(p(`"${query.alias}"."categoryId" = :categoryId`), { categoryId });
						}
					}
				})
			);

			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Delete articles by category ID.
	 */
	async deleteBulkByCategoryId(ids: string[]) {
		if (isNotEmpty(ids)) {
			return await this.typeOrmRepository.delete(ids);
		}
	}

	/**
	 * Update an article by ID.
	 */
	public async updateArticleById(id: string, input: IHelpCenterArticleUpdate): Promise<void> {
		await this.typeOrmRepository.update(id, input);
	}

	/**
	 * Update an article with automatic version snapshot.
	 * Creates a version snapshot of the current state before applying the update.
	 *
	 * @param id - Article ID
	 * @param input - Partial update data (any field including isLocked, archivedAt, privacy, etc.)
	 * @param ownedById - Employee ID making the change
	 */
	public async updateWithVersioning(
		id: ID,
		input: IHelpCenterArticleUpdate,
		ownedById?: ID
	): Promise<{ article: IHelpCenterArticle; version: IHelpCenterArticleVersion }> {
		// 1. Get current article state
		const { record: currentArticle } = await this.findOneOrFailByIdString(id);

		// 2. Create version snapshot of current state (before update) — include binary
		const versionInput: DeepPartial<HelpCenterArticleVersion> = {
			articleId: id,
			ownedById,
			descriptionHtml: currentArticle.descriptionHtml,
			descriptionJson: currentArticle.descriptionJson,
			descriptionBinary: currentArticle.descriptionBinary,
			lastSavedAt: new Date()
		};
		const version = await this.versionService.create(versionInput);

		// 3. Apply update
		await super.update(id, input);

		// 4. Return updated article and version
		const { record: updatedArticle } = await this.findOneOrFailByIdString(id);
		return { article: updatedArticle, version };
	}

	/**
	 * Get the raw binary description of an article.
	 * Returns null if not yet set.
	 */
	public async getDescriptionBinary(id: ID): Promise<Uint8Array | null> {
		const { record: article } = await this.findOneOrFailByIdString(id, {
			select: { descriptionBinary: true } as any
		});
		return article?.descriptionBinary ?? null;
	}

	/**
	 * Duplicate an article.
	 */
	public async duplicate(id: ID): Promise<HelpCenterArticle> {
		const ownedById = RequestContext.currentEmployeeId();

		// Load the source with its M2M relations so we can copy them
		const { record: source } = await this.findOneOrFailByIdString(id, {
			relations: { projects: true, tags: true } as any
		});

		const copy: DeepPartial<HelpCenterArticle> = {
			name: `${source.name} (Copy)`,
			description: source.description,
			data: source.data,
			draft: source.draft,
			privacy: source.privacy,
			index: source.index,
			descriptionHtml: source.descriptionHtml,
			descriptionJson: source.descriptionJson,
			descriptionBinary: null,
			isLocked: false,
			color: source.color,
			categoryId: source.categoryId,
			parentId: source.parentId,
			ownedById: ownedById ?? source.ownedById,
			organizationId: source.organizationId,
			externalId: null,
			projects: source.projects ?? [],
			tags: source.tags ?? []
		};

		return await this.create(copy);
	}

	/**
	 * Constructs advanced `where` conditions for filtering articles based on the provided filters and existing conditions.
	 *
	 * @private
	 * @param {IHelpCenterArticleAdvancedFilter} [filters] - Advanced filtering criteria for articles.
	 * @param {FindOptionsWhere<HelpCenterArticle>} [where] - Existing `where` conditions to be merged with the filters.
	 * @returns {FindOptionsWhere<HelpCenterArticle>} A `where` condition object to be used in database queries.
	 */
	private buildAdvancedWhereCondition(
		filters?: IHelpCenterArticleAdvancedFilter,
		where: FindOptionsWhere<HelpCenterArticle> = {}
	): FindOptionsWhere<HelpCenterArticle> {
		const {
			ids = [],
			names = [],
			tags = [],
			projects = [],
			categories = [],
			authors = [],
			ownedBy = [],
			draft,
			privacy,
			isLocked
		} = filters;

		return {
			...(ids.length && !where.id ? { id: In(ids) } : {}),
			...(names.length && !where.name ? { name: In(names) } : {}),
			...(tags.length && !where.tags ? { tags: { id: In(tags) } } : {}),
			...(projects.length && !where.projects ? { projects: { id: In(projects) } } : {}),
			...(categories.length && !where.categoryId ? { categoryId: In(categories) } : {}),
			...(authors.length && !where.authors ? { authors: { employeeId: In(authors) } } : {}),
			...(ownedBy.length && !where.ownedById ? { ownedById: In(ownedBy) } : {}),
			...(draft !== undefined && where.draft === undefined ? { draft } : {}),
			...(privacy !== undefined && where.privacy === undefined ? { privacy } : {}),
			...(isLocked !== undefined && where.isLocked === undefined ? { isLocked } : {})
		};
	}
}
