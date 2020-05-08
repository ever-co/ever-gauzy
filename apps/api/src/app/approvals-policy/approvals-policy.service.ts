import { CrudService, IPagination } from '../core';
import { ApprovalsPolicy } from './approvals-policy.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { ApprovalsPolicy as IApprovalsPolicy } from '@gauzy/models';

@Injectable()
export class ApprovalsPolicyService extends CrudService<ApprovalsPolicy> {
	constructor(
		@InjectRepository(ApprovalsPolicy)
		private readonly approvalsPolicyRepository: Repository<ApprovalsPolicy>
	) {
		super(approvalsPolicyRepository);
	}

	async getAllpolicies(
		filter?: FindManyOptions<ApprovalsPolicy>
	): Promise<IPagination<IApprovalsPolicy>> {
		const total = await this.approvalsPolicyRepository.count(filter);
		const items = await this.approvalsPolicyRepository.find(filter);

		return { items, total };
	}
}
