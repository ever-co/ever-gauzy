import { CrudService, IPagination } from '../core';
import { ApprovalsPolicy } from './approvals-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import {
	ApprovalsPolicy as IApprovalsPolicy,
	ApprovalsPolicyCreateInput as IApprovalsPolicyCreateInput
} from '@gauzy/models';

@Injectable()
export class ApprovalsPolicyService extends CrudService<ApprovalsPolicy> {
	constructor(
		@InjectRepository(ApprovalsPolicy)
		private readonly approvalsPolicyRepository: Repository<ApprovalsPolicy>
	) {
		super(approvalsPolicyRepository);
	}

	async getAllPolicies(
		filter?: FindManyOptions<ApprovalsPolicy>
	): Promise<IPagination<IApprovalsPolicy>> {
		console.log('filter', filter);
		const total = await this.approvalsPolicyRepository.count(filter);
		const items = await this.approvalsPolicyRepository.find(filter);

		return { items, total };
	}

	async create(
		entity: IApprovalsPolicyCreateInput
	): Promise<ApprovalsPolicy> {
		try {
			const approvalsPolicy = new ApprovalsPolicy();

			approvalsPolicy.name = entity.name;
			approvalsPolicy.organizationId = entity.organizationId;
			approvalsPolicy.tenantId = entity.tenantId;
			approvalsPolicy.type = entity.type;
			approvalsPolicy.description = entity.description;

			return this.approvalsPolicyRepository.save(approvalsPolicy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async update(
		id: string,
		entity: IApprovalsPolicyCreateInput
	): Promise<ApprovalsPolicy> {
		try {
			const approvalsPolicy = await this.approvalsPolicyRepository.findOne(
				id
			);

			approvalsPolicy.name = entity.name;
			approvalsPolicy.organizationId = entity.organizationId;
			approvalsPolicy.tenantId = entity.tenantId;
			approvalsPolicy.type = entity.type;
			approvalsPolicy.description = entity.description;
			return this.approvalsPolicyRepository.save(approvalsPolicy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
