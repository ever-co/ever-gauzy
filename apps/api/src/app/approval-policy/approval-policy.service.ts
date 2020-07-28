import { CrudService, IPagination } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository, Not, Equal } from 'typeorm';
import {
	ApprovalPolicy as IApprovalPolicy,
	ApprovalPolicyCreateInput as IApprovalPolicyCreateInput,
	ApprovalPolicyConst
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

	async findApprovalPoliciesForRequestApproval(): Promise<
		IPagination<IApprovalPolicy>
	> {
		const total = await this.approvalPolicyRepository.count({
			where: [
				{
					nameConst: Not(Equal(ApprovalPolicyConst.EQUIPMENT_SHARING))
				},
				{
					nameConst: Not(Equal(ApprovalPolicyConst.TIME_OFF))
				}
			]
		});

		const items = await this.approvalPolicyRepository.find({
			where: [
				{
					nameConst: Not(Equal(ApprovalPolicyConst.EQUIPMENT_SHARING))
				},
				{
					nameConst: Not(Equal(ApprovalPolicyConst.TIME_OFF))
				}
			]
		});

		return { items, total };
	}

	async create(entity: IApprovalPolicyCreateInput): Promise<ApprovalPolicy> {
		try {
			const approvalPolicy = new ApprovalPolicy();

			approvalPolicy.name = entity.name;
			approvalPolicy.organizationId = entity.organizationId;
			approvalPolicy.tenantId = entity.tenantId;
			approvalPolicy.description = entity.description;
			approvalPolicy.nameConst = entity.name
				? entity.name.replace(/\s+/g, '_').toUpperCase()
				: null;
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
			approvalPolicy.description = entity.description;
			approvalPolicy.nameConst = entity.name
				? entity.name.replace(/\s+/g, '_').toUpperCase()
				: null;
			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
