import { In, FindOptionsWhere, DeleteResult } from 'typeorm';
import { IHelpCenterAuthor } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { isNotEmpty } from '@gauzy/utils';
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

	/**
	 * Get authors by article ID.
	 *
	 * @param articleId - The ID of the article to filter authors by.
	 * @returns A promise that resolves to an array of help center authors for the article.
	 */
	public async findByArticleId(articleId: string): Promise<HelpCenterAuthor[]> {
		return await this.find({
			where: { articleId } as FindOptionsWhere<HelpCenterAuthor>
		});
	}

	/**
	 * Create authors in Bulk
	 *
	 * @param input
	 * @returns
	 */
	async createBulk(input: IHelpCenterAuthor[]): Promise<HelpCenterAuthor[]> {
		return await this.saveMany(input);
	}

	/**
	 * Delete authors by IDs in Bulk
	 *
	 * @param ids
	 * @returns
	 */
	async deleteBulk(ids: string[]): Promise<DeleteResult> {
		if (isNotEmpty(ids)) {
			return await this.delete({ id: In(ids) } as FindOptionsWhere<HelpCenterAuthor>);
		}

		return { affected: 0, raw: [] };
	}

	/**
	 * Get all authors with optional filters and relations.
	 *
	 * @param options - Find options to customize the query (e.g., relations, order).
	 * @returns A promise that resolves to an array of help center authors.
	 */
	public async getAll(options?: any): Promise<IHelpCenterAuthor[]> {
		return await this.find(options);
	}
}
