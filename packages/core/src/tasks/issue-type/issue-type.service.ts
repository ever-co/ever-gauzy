import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { IIssueType } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../../core/crud';
import { IssueType } from './issue-type.entity';

@Injectable()
export class IssueTypeService extends TenantAwareCrudService<IssueType> {

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
}
