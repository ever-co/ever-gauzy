import { IHelpCenterAuthor } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { HelpCenterAuthor } from './help-center-author.entity';

@Injectable()
export class HelpCenterAuthorService extends CrudService<HelpCenterAuthor> {
	constructor(
		@InjectRepository(HelpCenterAuthor)
		private readonly HelpCenterAuthorRepository: Repository<
			HelpCenterAuthor
		>
	) {
		super(HelpCenterAuthorRepository);
	}
	async findByArticleId(articleId: string): Promise<HelpCenterAuthor[]> {
		return await this.repository
			.createQueryBuilder('knowledge_base_author')
			.where('knowledge_base_author.articleId = :articleId', {
				articleId
			})
			.getMany();
	}
	async createBulk(createInput: IHelpCenterAuthor[]) {
		return await this.repository.save(createInput);
	}
	async deleteBulkByArticleId(ids: string[]) {
		return await this.repository.delete(ids);
	}
}
