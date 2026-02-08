import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { ID, IHelpCenterArticle } from '@gauzy/contracts';
import { HelpCenterArticleVersion } from './help-center-article-version.entity';
import { HelpCenterArticleService } from './help-center-article.service';
import { TypeOrmHelpCenterArticleVersionRepository } from './repository/type-orm-help-center-article-version.repository';
import { MikroOrmHelpCenterArticleVersionRepository } from './repository/mikro-orm-help-center-article-version.repository';
/**
 * Service for managing HelpCenterArticle versions.
 * Inherits all CRUD operations from TenantAwareCrudService.
 */
@Injectable()
export class HelpCenterArticleVersionService extends TenantAwareCrudService<HelpCenterArticleVersion> {
	constructor(
		readonly typeOrmHelpCenterArticleVersionRepository: TypeOrmHelpCenterArticleVersionRepository,
		readonly mikroOrmHelpCenterArticleVersionRepository: MikroOrmHelpCenterArticleVersionRepository,
		@Inject(forwardRef(() => HelpCenterArticleService))
		private readonly articleService: HelpCenterArticleService
	) {
		super(typeOrmHelpCenterArticleVersionRepository, mikroOrmHelpCenterArticleVersionRepository);
	}

	/**
	 * Restore an article to a specific version's content.
	 * Copies the version's descriptionHtml/Json back to the article.
	 *
	 * @param versionId - The version ID to restore from
	 * @returns The updated article
	 */
	async restoreToVersion(versionId: ID): Promise<IHelpCenterArticle | UpdateResult> {
		// Get the version
		const { record: version } = await this.findOneOrFailByIdString(versionId);

		// Update the article with the version's content
		return await this.articleService.update(version.articleId, {
			descriptionHtml: version.descriptionHtml,
			descriptionJson: version.descriptionJson
		});
	}
}
