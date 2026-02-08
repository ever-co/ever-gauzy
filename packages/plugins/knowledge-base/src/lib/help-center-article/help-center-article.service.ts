import { Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
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

	async getArticlesByCategoryId(categoryId: string): Promise<HelpCenterArticle[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('knowledge_base_article')
			.where('knowledge_base_article.categoryId = :categoryId', {
				categoryId
			})
			.getMany();
	}

	async deleteBulkByCategoryId(ids: string[]) {
		if (isNotEmpty(ids)) {
			return await this.typeOrmRepository.delete(ids);
		}
	}

	public async updateArticleById(id: string, input: IHelpCenterArticleUpdate): Promise<void> {
		await this.typeOrmRepository.update(id, input);
	}

	/**
	 * Update an article with automatic version snapshot.
	 * Creates a version of the current state before applying the update.
	 * 
	 * Note: This is not wrapped in a transaction. If the update fails after version creation,
	 * an orphan version record may remain. Consider wrapping in a transaction if atomicity is critical.
	 *
	 * @param id - Article ID
	 * @param input - Update data
	 * @param ownedById - Employee ID who is making this change (optional for admins without employee)
	 * @returns The updated article and the created version
	 */
	public async updateWithVersioning(
		id: ID,
		input: IHelpCenterArticleUpdate,
		ownedById?: ID
	): Promise<{ article: IHelpCenterArticle; version: IHelpCenterArticleVersion }> {
		// 1. Get current article state
		const { record: currentArticle } = await this.findOneOrFailByIdString(id);

		// 2. Create version snapshot of current state (before update)
		const versionInput: DeepPartial<HelpCenterArticleVersion> = {
			articleId: id,
			ownedById,
			descriptionHtml: currentArticle.descriptionHtml,
			descriptionJson: currentArticle.descriptionJson,
			lastSavedAt: new Date()
		};
		const version = await this.versionService.create(versionInput);

		// 3. Update the article
		await super.update(id, input);

		// 4. Return updated article and version
		const { record: updatedArticle } = await this.findOneOrFailByIdString(id);

		return { article: updatedArticle, version };
	}
}
