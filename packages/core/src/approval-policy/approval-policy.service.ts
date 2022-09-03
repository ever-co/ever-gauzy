import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Not, In } from 'typeorm';
import {
	IApprovalPolicy,
	ApprovalPolicyTypesStringEnum,
	IListQueryInput,
	IRequestApprovalFindInput,
	IPagination
} from '@gauzy/contracts';
import { ApprovalPolicy } from './approval-policy.entity';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';

@Injectable()
export class ApprovalPolicyService extends TenantAwareCrudService<ApprovalPolicy> {
	constructor(
		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>
	) {
		super(approvalPolicyRepository);
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
				options.where.name = Like(`%${where.name}%`)
			}
		}
		return super.paginate(options);
	}

	/*
	 * Get all approval policies
	 */
	async findAllApprovalPolicies(
		options: PaginationParams<ApprovalPolicy>
	): Promise<IPagination<IApprovalPolicy>> {
		return await super.findAll({
			...(
				(options && options.where) ? {
					where: options.where
				} : {}
			),
			...(
				(options && options.relations) ? {
					relations: options.relations
				} : {}
			),
		});
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
			...(
				(relations) ? {
					relations: relations
				} : {}
			),
		};
		return await super.findAll(query);
	}
}
