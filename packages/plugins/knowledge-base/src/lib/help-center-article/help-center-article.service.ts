import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/utils';
import { IHelpCenterArticleUpdate } from '@gauzy/contracts';
import { HelpCenterArticle } from './help-center-article.entity';
import { TypeOrmHelpCenterArticleRepository } from './repository/type-orm-help-center-article.repository';
import { MikroOrmHelpCenterArticleRepository } from './repository/mikro-orm-help-center-article.repository';

@Injectable()
export class HelpCenterArticleService extends TenantAwareCrudService<HelpCenterArticle> {
	constructor(
		readonly typeOrmHelpCenterArticleRepository: TypeOrmHelpCenterArticleRepository,
		readonly mikroOrmHelpCenterArticleRepository: MikroOrmHelpCenterArticleRepository
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
}
