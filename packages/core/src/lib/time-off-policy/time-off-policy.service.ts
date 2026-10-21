import { ID, IEmployee, ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
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

/**
 * An employee named by a policy write. The Angular dialog and MCP send ids, while the contract
 * (`IEmployee[]`) and the GraphQL resolver send rows.
 */
type EmployeeReference = ID | Pick<IEmployee, 'id'>;

function toEmployeeId(employee: EmployeeReference): ID | undefined {
	if (typeof employee === 'string') {
		return employee;
	}
	return employee?.id;
}

/**
 * The ids the employee lookup takes. `In(...)` only binds ids: a row reaches the database as JSON
 * and an absent list is not iterable, so both used to fail the whole write.
 */
function toEmployeeIds(employees: EmployeeReference[] | null | undefined): ID[] {
	const ids: ID[] = [];
	if (!Array.isArray(employees)) {
		return ids;
	}
	for (const employee of employees) {
		const id = toEmployeeId(employee);
		if (id) {
			ids.push(id);
		}
	}
	return ids;
}

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
			policy.employees = await this.findPolicyEmployees(entity.employees, tenantId, organizationId);

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

			// A body without employees keeps the current members: the save skips a relation left unset.
			const hasEmployeesInBody = Array.isArray(entity.employees);
			if (hasEmployeesInBody) {
				policy.employees = await this.findPolicyEmployees(entity.employees, tenantId, organizationId);
			}

			// Save the policy
			return await this.save(policy);
		} catch (error) {
			throw new HttpException(`Error while updating time-off policy: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * The employees a policy write names, looked up in the caller's own tenant and organization.
	 *
	 * @param employees Ids or rows, as the write received them
	 * @param tenantId
	 * @param organizationId
	 * @returns
	 */
	private async findPolicyEmployees(
		employees: EmployeeReference[] | null | undefined,
		tenantId: ID,
		organizationId: ID
	): Promise<IEmployee[]> {
		const employeeIds = toEmployeeIds(employees);
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.find(
					{ id: { $in: employeeIds }, tenantId, organizationId } as any,
					{ populate: ['user'] }
				);
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmEmployeeRepository.find({
					where: { id: In(employeeIds), tenantId, organizationId },
					relations: { user: true }
				});
		}
	}
}
