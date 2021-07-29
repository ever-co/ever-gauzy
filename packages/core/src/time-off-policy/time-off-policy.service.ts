import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Employee } from '../employee/employee.entity';
import {
	ITimeOffPolicyCreateInput,
	ITimeOffPolicyUpdateInput
} from '@gauzy/contracts';

@Injectable()
export class TimeOffPolicyService extends TenantAwareCrudService<TimeOffPolicy> {
	constructor(
		@InjectRepository(TimeOffPolicy)
		private readonly policyRepository: Repository<TimeOffPolicy>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(policyRepository);
	}

	async create(entity: ITimeOffPolicyCreateInput): Promise<TimeOffPolicy> {
		const policy = new TimeOffPolicy();

		policy.name = entity.name;
		policy.organizationId = entity.organizationId;
		policy.tenantId = entity.tenantId;
		policy.requiresApproval = entity.requiresApproval;
		policy.paid = entity.paid;

		const employees = await this.employeeRepository.findByIds(
			entity.employees,
			{
				relations: ['user']
			}
		);

		policy.employees = employees;

		return this.policyRepository.save(policy);
	}

	async update(
		id: string,
		entity: ITimeOffPolicyUpdateInput
	): Promise<TimeOffPolicy> {
		try {
			await this.policyRepository.delete(id);
			const policy = new TimeOffPolicy();

			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.tenantId = entity.tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			const employees = await this.employeeRepository.findByIds(
				entity.employees,
				{
					relations: ['user']
				}
			);

			policy.employees = employees;

			return this.policyRepository.save(policy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
