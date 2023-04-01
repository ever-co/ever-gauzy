import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';
import { IIssueType, IIssueTypeFindInput, IPagination } from '@gauzy/contracts';
import { IssueType } from './issue-type.entity';
import { TaskStatusPrioritySizeService } from './../task-status-priority-size.service';

@Injectable()
export class IssueTypeService extends TaskStatusPrioritySizeService<IssueType> {

	constructor(
		@InjectRepository(IssueType)
		protected readonly issueTypeRepository: Repository<IssueType>
	) {
		super(issueTypeRepository);
	}

	/**
	 * Few issue types can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IIssueType['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}

	/**
	 * GET issue types by filters
	 * If parameters not match, retrieve global issue types
	 *
	 * @param params
	 * @returns
	 */
	async findAllIssueTypes(
		params: IIssueTypeFindInput
	): Promise<IPagination<IIssueType>> {
		try {
			/**
			 * Find at least one record or get global records
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<IssueType>) => {
				this.getFilterQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find task issue types for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias).setFindOptions({
				relations: {
					image: true
				}
			});
			query.where((qb: SelectQueryBuilder<IssueType>) => {
				this.getFilterQuery(qb, params);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			return await this.getDefaultEntities();
		}
	}
}
