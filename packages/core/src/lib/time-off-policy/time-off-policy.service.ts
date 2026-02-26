import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { In } from 'typeorm';
import { ID, ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
import { MultiORMEnum, TenantAwareCrudService } from '@gauzy/core';
import { RequestContext } from '../core/context';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { TypeOrmTimeOffPolicyRepository } from './repository/type-orm-time-off-policy.repository';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';
import { TimeOffPolicy } from './time-off-policy.entity';

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
			let employees;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					employees = await this.mikroOrmEmployeeRepository.find(
						{ id: { $in: entity.employees as unknown as string[] }, tenantId, organizationId } as any,
						{ populate: ['user'] }
					);
					break;
				case MultiORMEnum.TypeORM:
				default:
					employees = await this.typeOrmEmployeeRepository.find({
						where: { id: In(entity.employees), tenantId, organizationId },
						relations: { user: true }
					});
					break;
			}
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
			await this.delete({
				id,
				tenantId,
				organizationId
			} as any);

			const policy = new TimeOffPolicy();
			policy.name = entity.name;
			policy.organizationId = organizationId;
			policy.tenantId = tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			let employees;
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					employees = await this.mikroOrmEmployeeRepository.find(
						{ id: { $in: entity.employees as unknown as string[] }, tenantId, organizationId } as any,
						{ populate: ['user'] }
					);
					break;
				case MultiORMEnum.TypeORM:
				default:
					employees = await this.typeOrmEmployeeRepository.find({
						where: { id: In(entity.employees), tenantId, organizationId },
						relations: { user: true }
					});
					break;
			}
			policy.employees = employees;

			// Save the policy
			return await this.save(policy);
		} catch (error) {
			throw new HttpException(`Error while updating time-off policy: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
