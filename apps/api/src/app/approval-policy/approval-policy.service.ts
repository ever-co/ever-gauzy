import { CrudService, IPagination } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import {
	ApprovalPolicy as IApprovalPolicy,
	ApprovalPolicyCreateInput as IApprovalPolicyCreateInput
} from '@gauzy/models';

@Injectable()
export class ApprovalPolicyService extends CrudService<ApprovalPolicy> {
	constructor(
		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>
	) {
		super(approvalPolicyRepository);
	}

	async findAllApprovalPolicies(
		filter?: FindManyOptions<ApprovalPolicy>
	): Promise<IPagination<IApprovalPolicy>> {
		const total = await this.approvalPolicyRepository.count(filter);
		const items = await this.approvalPolicyRepository.find(filter);

		return { items, total };
	}

	async create(entity: IApprovalPolicyCreateInput): Promise<ApprovalPolicy> {
		try {
			const approvalPolicy = new ApprovalPolicy();

			approvalPolicy.name = entity.name;
			approvalPolicy.organizationId = entity.organizationId;
			approvalPolicy.tenantId = entity.tenantId;
			approvalPolicy.type = entity.type;
			approvalPolicy.description = entity.description;

			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	async update(
		id: string,
		entity: IApprovalPolicyCreateInput
	): Promise<ApprovalPolicy> {
		try {
			const approvalPolicy = await this.approvalPolicyRepository.findOne(
				id
			);
			approvalPolicy.name = entity.name;
			approvalPolicy.organizationId = entity.organizationId;
			approvalPolicy.tenantId = entity.tenantId;
			approvalPolicy.type = entity.type;
			approvalPolicy.description = entity.description;
			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
