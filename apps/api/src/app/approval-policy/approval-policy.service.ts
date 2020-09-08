import { CrudService, IPagination } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository, Not, In } from 'typeorm';
import {
	ApprovalPolicy as IApprovalPolicy,
	ApprovalPolicyCreateInput as IApprovalPolicyCreateInput,
	ApprovalPolicyTypesStringEnum
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

	async findApprovalPoliciesForRequestApproval(
		organizationId?: string,
		relations?: string[]
	): Promise<IPagination<IApprovalPolicy>> {
		console.log('organizationId', organizationId);
		console.log('relations', relations);

		const total = await this.approvalPolicyRepository.count({
			where: {
				approvalType: Not(
					In([
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
						ApprovalPolicyTypesStringEnum.TIME_OFF
					])
				),
				organizationId
			}
		});

		const items = await this.approvalPolicyRepository.find({
			where: {
				approvalType: Not(
					In([
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
						ApprovalPolicyTypesStringEnum.TIME_OFF
					])
				),
				organizationId
			},
			relations
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
			approvalPolicy.approvalType = entity.name
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
			approvalPolicy.tenant = entity.tenant;
			approvalPolicy.description = entity.description;
			approvalPolicy.approvalType = entity.name
				? entity.name.replace(/\s+/g, '_').toUpperCase()
				: null;
			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
