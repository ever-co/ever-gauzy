import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
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
	async findIssueTypes(
		params: IIssueTypeFindInput
	): Promise<IPagination<IIssueType>> {
		try {
			return await this.findEntitiesByParams(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
