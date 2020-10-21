import { CrudService, IPagination } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository, Not, In } from 'typeorm';
import {
	IApprovalPolicy,
	IApprovalPolicyCreateInput,
	ApprovalPolicyTypesStringEnum,
	IRequestApprovalFindInput
} from '@gauzy/models';
import { RequestContext } from '../core/context';

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
		findInput?: IRequestApprovalFindInput,
		relations?: string[]
	): Promise<IPagination<IApprovalPolicy>> {
		const { organizationId, tenantId } = findInput;
		const query = {
			where: {
				approvalType: Not(
					In([
						ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
						ApprovalPolicyTypesStringEnum.TIME_OFF
					])
				),
				organizationId,
				tenantId
			},
			relations
		};
		const total = await this.approvalPolicyRepository.count(query);
		const items = await this.approvalPolicyRepository.find(query);
		return { items, total };
	}

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
			approvalPolicy.tenantId = RequestContext.currentTenantId();
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
