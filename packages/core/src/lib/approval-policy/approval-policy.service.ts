import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Not, In } from 'typeorm';
import {
	IApprovalPolicy,
	ApprovalPolicyTypesStringEnum,
	IListQueryInput,
	IRequestApprovalFindInput,
	IPagination,
	IApprovalPolicyCreateInput
} from '@gauzy/contracts';
import { ApprovalPolicy } from './approval-policy.entity';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { TypeOrmApprovalPolicyRepository } from './repository/type-orm-approval-policy.repository';
import { MikroOrmApprovalPolicyRepository } from './repository/mikro-orm-approval-policy.repository';

@Injectable()
export class ApprovalPolicyService extends TenantAwareCrudService<ApprovalPolicy> {
	constructor(
		@InjectRepository(ApprovalPolicy)
		typeOrmApprovalPolicyRepository: TypeOrmApprovalPolicyRepository,

		mikroOrmApprovalPolicyRepository: MikroOrmApprovalPolicyRepository
	) {
		super(typeOrmApprovalPolicyRepository, mikroOrmApprovalPolicyRepository);
	}

	/**
	 * GET approval policies by pagination
	 *
	 * @param options
	 * @returns
	 */
	public pagination(options: PaginationParams<ApprovalPolicy>) {
		if ('where' in options) {
			const { where } = options;
			if ('name' in where) {
				options.where.name = Like(`%${where.name}%`);
			}
		}
		return super.paginate(options);
	}

	/*
	 * Get all approval policies
	 */
	async findAllApprovalPolicies(options: PaginationParams<ApprovalPolicy>): Promise<IPagination<IApprovalPolicy>> {
		return await super.findAll({
			...(options && options.where
				? {
					where: options.where
				}
				: {}),
			...(options && options.relations
				? {
					relations: options.relations
				}
				: {})
		});
	}

	/*
	 * Get all request approval policies
	 */
	async findApprovalPoliciesForRequestApproval({
		findInput,
		relations
	}: IListQueryInput<IRequestApprovalFindInput>): Promise<IPagination<IApprovalPolicy>> {
		const query = {
			where: {
				approvalType: Not(
					In([ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING, ApprovalPolicyTypesStringEnum.TIME_OFF])
				),
				...findInput
			},
			...(relations
				? {
					relations: relations
				}
				: {})
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
			approvalPolicy.approvalType = entity.name ? entity.name.replace(/\s+/g, '_').toUpperCase() : null;
			return await this.save(approvalPolicy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/*
	 * Update approval policy
	 */
	async update(id: string, entity: IApprovalPolicyCreateInput): Promise<ApprovalPolicy> {
		try {
			const approvalPolicy = await this.findOneByIdString(id);
			approvalPolicy.name = entity.name;
			approvalPolicy.organizationId = entity.organizationId;
			approvalPolicy.tenantId = RequestContext.currentTenantId();
			approvalPolicy.description = entity.description;
			approvalPolicy.approvalType = entity.name ? entity.name.replace(/\s+/g, '_').toUpperCase() : null;
			return await this.save(approvalPolicy);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
