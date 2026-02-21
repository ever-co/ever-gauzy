import { Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/utils';
import { ID, IHelpCenterArticle, IHelpCenterArticleUpdate, IHelpCenterArticleVersion } from '@gauzy/contracts';
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
	async getArticlesByCategoryId(categoryId: string): Promise<HelpCenterArticle[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('knowledge_base_article')
			.where('knowledge_base_article.categoryId = :categoryId', {
				categoryId
			})
			.getMany();
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
}
