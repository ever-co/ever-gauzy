import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { In } from 'typeorm';
import { ID, ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from '../employee/repository';
import { TimeOffPolicy } from './time-off-policy.entity';
import { MikroOrmTimeOffPolicyRepository, TypeOrmTimeOffPolicyRepository } from './repository';

@Injectable()
export class TimeOffPolicyService extends TenantAwareCrudService<TimeOffPolicy> {
	constructor(
		readonly typeOrmTimeOffPolicyRepository: TypeOrmTimeOffPolicyRepository,
		readonly mikroOrmTimeOffPolicyRepository: MikroOrmTimeOffPolicyRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {
		super(typeOrmTimeOffPolicyRepository, mikroOrmTimeOffPolicyRepository);
	}

	/**
	 * Create Time Off Policy
	 *
	 * @param entity
	 * @returns
	 */
	async create(entity: ITimeOffPolicyCreateInput): Promise<TimeOffPolicy> {
		try {
			const tenantId = RequestContext.currentTenantId() || entity.tenantId;
			const organizationId = entity.organizationId;

			const policy = new TimeOffPolicy();
			policy.name = entity.name;
			policy.organizationId = organizationId;
			policy.tenantId = tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			// Find employees
			const employees = await this.typeOrmEmployeeRepository.find({
				where: { id: In(entity.employees), tenantId, organizationId },
				relations: { user: true }
			});
			policy.employees = employees;

			// Save the policy
			return await this.save(policy);
		} catch (error) {
			throw new HttpException(`Error while creating time-off policy: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Update Time Off Policy
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	async update(id: ID, entity: ITimeOffPolicyUpdateInput): Promise<TimeOffPolicy> {
		try {
			const tenantId = RequestContext.currentTenantId() || entity.tenantId;
			const organizationId = entity.organizationId;

			// Delete the policy
			await this.typeOrmRepository.delete({
				id,
				tenantId,
				organizationId
			});

			const policy = new TimeOffPolicy();
			policy.name = entity.name;
			policy.organizationId = organizationId;
			policy.tenantId = tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			const employees = await this.typeOrmEmployeeRepository.find({
				where: { id: In(entity.employees) },
				relations: { user: true }
			});
			policy.employees = employees;

			// Save the policy
			return await this.save(policy);
		} catch (error) {
			throw new HttpException(`Error while updating time-off policy: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
