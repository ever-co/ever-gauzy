import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Employee } from '../employee/employee.entity';

@Injectable()
export class TimeOffPolicyService extends TenantAwareCrudService<TimeOffPolicy> {
	constructor(
		@InjectRepository(TimeOffPolicy)
		private readonly policyRepository: Repository<TimeOffPolicy>,
		@MikroInjectRepository(TimeOffPolicy)
		private readonly mikroPolicyRepository: EntityRepository<TimeOffPolicy>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@MikroInjectRepository(Employee)
		private readonly mikroEmployeeRepository: EntityRepository<Employee>
	) {
		super(policyRepository, mikroPolicyRepository);
	}

	async create(entity: ITimeOffPolicyCreateInput): Promise<TimeOffPolicy> {
		const policy = new TimeOffPolicy();

		policy.name = entity.name;
		policy.organizationId = entity.organizationId;
		policy.tenantId = entity.tenantId;
		policy.requiresApproval = entity.requiresApproval;
		policy.paid = entity.paid;

		const employees = await this.employeeRepository.find({
			where: {
				id: In(entity.employees)
			},
			relations: {
				user: true
			}
		});
		policy.employees = employees;
		return this.policyRepository.save(policy);
	}

	async update(id: string, entity: ITimeOffPolicyUpdateInput): Promise<TimeOffPolicy> {
		try {
			await this.policyRepository.delete(id);
			const policy = new TimeOffPolicy();

			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.tenantId = entity.tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			const employees = await this.employeeRepository.find({
				where: {
					id: In(entity.employees)
				},
				relations: {
					user: true
				}
			});
			policy.employees = employees;
			return this.policyRepository.save(policy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
