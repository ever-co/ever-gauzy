import { BadRequestException, Injectable } from '@nestjs/common';
import { Like, Not, In } from 'typeorm';
import {
	IApprovalPolicy,
	ApprovalPolicyTypesStringEnum,
	IListQueryInput,
	IRequestApprovalFindInput,
	IPagination,
	IApprovalPolicyCreateInput
} from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
import { ApprovalPolicy } from './approval-policy.entity';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { TypeOrmApprovalPolicyRepository } from './repository/type-orm-approval-policy.repository';
import { MikroOrmApprovalPolicyRepository } from './repository/mikro-orm-approval-policy.repository';

@Injectable()
export class ApprovalPolicyService extends TenantAwareCrudService<ApprovalPolicy> {
	constructor(
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
	public pagination(options: BaseQueryDTO<ApprovalPolicy>) {
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
	async findAllApprovalPolicies(options: BaseQueryDTO<ApprovalPolicy>): Promise<IPagination<IApprovalPolicy>> {
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
				: {}),
			// This reader builds its options by *naming* the members it forwards, so anything it does not name is
			// dropped — and `withDeleted` is not a criterion, so leaving it out would answer the live rows to a
			// caller that asked for the retired ones, with nothing to tell it so. The REST list route beside this
			// one inherits the flag from `BaseQueryDTO`, so both surfaces have to honour it.
			//
			// It is read as a boolean rather than by truthiness: that route mounts its validation pipe without
			// `transform`, so `?withDeleted=false` arrives as the non-empty string 'false', which a truthiness
			// test turned into a request for the soft-deleted policies.
			...(parseToBoolean(options?.withDeleted) ? { withDeleted: true } : {})
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
