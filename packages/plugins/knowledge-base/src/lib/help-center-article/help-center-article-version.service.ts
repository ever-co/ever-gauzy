import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { UpdateResult, DeepPartial } from 'typeorm';
import { TenantAwareCrudService, RequestContext } from '@gauzy/core';
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
	 * First creates a snapshot of the current article state to preserve it,
	 * then copies the version's descriptionHtml/Json back to the article.
	 *
	 * @param versionId - The version ID to restore from
	 * @returns The updated article
	 */
	async restoreToVersion(versionId: ID): Promise<IHelpCenterArticle | UpdateResult> {
		// 1. Get the version to restore
		const { record: version } = await this.findOneOrFailByIdString(versionId);

		// 2. Get current article state before overwriting
		const { record: currentArticle } = await this.articleService.findOneOrFailByIdString(version.articleId);

		// 3. Get current user's employee ID for version ownership
		const employeeId = RequestContext.currentEmployeeId() || RequestContext.currentUser()?.employeeId;

		// 4. Create a snapshot of the current state before restoring
		const snapshotInput: DeepPartial<HelpCenterArticleVersion> = {
			articleId: version.articleId,
			ownedById: employeeId,
			descriptionHtml: currentArticle.descriptionHtml,
			descriptionJson: currentArticle.descriptionJson,
			descriptionBinary: currentArticle.descriptionBinary,
			lastSavedAt: new Date()
		};
		await this.create(snapshotInput);

		// 5. Update the article with the version's content (including binary)
		return await this.articleService.update(version.articleId, {
			descriptionHtml: version.descriptionHtml,
			descriptionJson: version.descriptionJson,
			descriptionBinary: version.descriptionBinary
		});
	}
}
