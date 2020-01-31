import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { TimeOffPolicy } from './time-off-policy.entity';
import { CrudService } from '../../core/crud/crud.service';
import { IPagination } from '../../core';
import {
	TimeOffPolicyCreateInput as ITimeOffPolicyCreateInput,
	TimeOffPolicy as ITimeOffPolicy
} from '@gauzy/models';
import { Employee } from '../../employee';

@Injectable()
export class TimeOffPolicyService extends CrudService<TimeOffPolicy> {
	constructor(
		@InjectRepository(TimeOffPolicy)
		private readonly policyRepository: Repository<TimeOffPolicy>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(policyRepository);
	}

	async getAllPolicies(
		filter?: FindManyOptions<TimeOffPolicy>
	): Promise<IPagination<ITimeOffPolicy>> {
		const total = await this.repository.count(filter);
		const items = await this.repository.find(filter);

		return { items, total };
	}

	async create(entity: ITimeOffPolicyCreateInput): Promise<TimeOffPolicy> {
		const policy = new TimeOffPolicy();

		policy.name = entity.name;
		policy.organizationId = entity.organizationId;
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
}
