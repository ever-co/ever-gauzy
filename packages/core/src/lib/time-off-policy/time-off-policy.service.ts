import { ID, ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';
import { TypeOrmTimeOffPolicyRepository } from './repository/type-orm-time-off-policy.repository';
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
			policy.leaveType = entity.leaveType;
			policy.maxDaysPerYear = entity.maxDaysPerYear;
			policy.allowCarryForward = entity.allowCarryForward;
			policy.maxCarryForwardDays = entity.maxCarryForwardDays;
			policy.accrualRate = entity.accrualRate;
			policy.accrualFrequency = entity.accrualFrequency;
			policy.isDefault = entity.isDefault;

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
			// The body is not DTO-validated: an empty organizationId would scope the employee lookup
			// below to nothing (null -> IS NULL). Require it.
			if (!organizationId) {
				throw new HttpException('organizationId is required', HttpStatus.BAD_REQUEST);
			}

			// Edit the existing row rather than deleting it and inserting a replacement. The old
			// implementation issued a real DELETE and then saved a NEW policy with a NEW id, which
			// (a) detached every `time_off_request` that pointed at the policy — `policyId` is
			// `ON DELETE SET NULL` — and (b) would now cascade-delete the policy's whole
			// `time_off_balance` ledger. It also handed callers back an id they never asked for.
			const policy = await this.findOneByWhereOptions({ id, tenantId, organizationId });

			policy.name = entity.name;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;
			policy.leaveType = entity.leaveType;
			policy.maxDaysPerYear = entity.maxDaysPerYear;
			policy.allowCarryForward = entity.allowCarryForward;
			policy.maxCarryForwardDays = entity.maxCarryForwardDays;
			policy.accrualRate = entity.accrualRate;
			policy.accrualFrequency = entity.accrualFrequency;
			policy.isDefault = entity.isDefault;

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
