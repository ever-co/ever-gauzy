import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { HelpCenterArticle } from './help-center-article.entity';

@Injectable()
export class HelpCenterArticleService extends CrudService<HelpCenterArticle> {
	constructor(
		@InjectRepository(HelpCenterArticle)
		private readonly HelpCenterArticleRepository: Repository<
			HelpCenterArticle
		>
	) {
		super(HelpCenterArticleRepository);
	}

	async getArticlesByCategoryId(
		categoryId: string
	): Promise<HelpCenterArticle[]> {
		return await this.repository
			.createQueryBuilder('knowledge_base_article')
			.where('knowledge_base_article.categoryId = :categoryId', {
				categoryId
			})
			.getMany();
	}
}
