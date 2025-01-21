import { IHelpCenterAuthor } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/common';
import { HelpCenterAuthor } from './help-center-author.entity';
import { TypeOrmHelpCenterAuthorRepository } from './repository/type-orm-help-center-author.repository';
import { MikroOrmHelpCenterAuthorRepository } from './repository/mikro-orm-help-center-author.repository';

@Injectable()
export class HelpCenterAuthorService extends TenantAwareCrudService<HelpCenterAuthor> {
	constructor(
		typeOrmHelpCenterAuthorRepository: TypeOrmHelpCenterAuthorRepository,
		mikroOrmHelpCenterAuthorRepository: MikroOrmHelpCenterAuthorRepository
	) {
		super(typeOrmHelpCenterAuthorRepository, mikroOrmHelpCenterAuthorRepository);
	}

	async findByArticleId(articleId: string): Promise<HelpCenterAuthor[]> {
		return await this.typeOrmRepository
			.createQueryBuilder('knowledge_base_author')
			.where('knowledge_base_author.articleId = :articleId', {
				articleId
			})
			.getMany();
	}

	/**
	 *
	 * @param createInput
	 * @returns
	 */
	async createBulk(createInput: IHelpCenterAuthor[]) {
		return await this.typeOrmRepository.save(createInput);
	}

	/**
	 *
	 * @param ids
	 * @returns
	 */
	async deleteBulkByArticleId(ids: string[]) {
		if (isNotEmpty(ids)) {
			return await this.typeOrmRepository.delete(ids);
		}
	}

	/**
	 *
	 * @returns
	 */
	async getAll(): Promise<IHelpCenterAuthor[]> {
		return await this.typeOrmRepository.createQueryBuilder('knowledge_base_author').getMany();
	}
}
