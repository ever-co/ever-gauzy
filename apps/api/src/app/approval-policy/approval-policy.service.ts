import { TenantAwareCrudService, IPagination } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import {
	IApprovalPolicy,
	IApprovalPolicyCreateInput,
	ApprovalPolicyTypesStringEnum,
	IListQueryInput,
	IRequestApprovalFindInput
} from '@gauzy/models';
import { RequestContext } from '../core/context';

@Injectable()
export class ApprovalPolicyService extends TenantAwareCrudService<
	ApprovalPolicy
> {
	constructor(
		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>
	) {
		super(approvalPolicyRepository);
	}

	/*
	 * Get all approval policies
	 */
	async findAllApprovalPolicies({
		findInput: where,
		relations
	}: IListQueryInput<IRequestApprovalFindInput>): Promise<
		IPagination<IApprovalPolicy>
	> {
		const query = { where, relations };
		return await super.findAll(query);
	}

	/*
	 * Get all request approval policies
	 */
	async findApprovalPoliciesForRequestApproval({
		findInput,
		relations
	}: IListQueryInput<IRequestApprovalFindInput>): Promise<
		IPagination<IApprovalPolicy>
	> {
		const query = {
			where: {
				approvalType: Not(
					In([
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
						ApprovalPolicyTypesStringEnum.TIME_OFF
					])
				),
				...findInput
			},
			relations
		};
		return await super.findAll(query);
	}

	/*
	 * Create approval policy
	 */
	async create(entity: IApprovalPolicyCreateInput): Promise<ApprovalPolicy> {
		try {
			const approvalPolicy = new ApprovalPolicy();
			approvalPolicy.name = entity.name;
			approvalPolicy.organizationId = entity.organizationId;
			approvalPolicy.tenantId = RequestContext.currentTenantId();
			approvalPolicy.description = entity.description;
			approvalPolicy.approvalType = entity.name
				? entity.name.replace(/\s+/g, '_').toUpperCase()
				: null;
			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (error /*: WriteError*/) {
			throw new BadRequestException(error);
		}
	}

	/*
	 * Update approval policy
	 */
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
			approvalPolicy.tenantId = RequestContext.currentTenantId();
			approvalPolicy.description = entity.description;
			approvalPolicy.approvalType = entity.name
				? entity.name.replace(/\s+/g, '_').toUpperCase()
				: null;
			return this.approvalPolicyRepository.save(approvalPolicy);
		} catch (error /*: WriteError*/) {
			throw new BadRequestException(error);
		}
	}
}
