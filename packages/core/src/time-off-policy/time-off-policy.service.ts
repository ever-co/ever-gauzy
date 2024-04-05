import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { ITimeOffPolicyCreateInput, ITimeOffPolicyUpdateInput } from '@gauzy/contracts';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TenantAwareCrudService } from './../core/crud';
import { Employee } from '../employee/employee.entity';
import { TypeOrmTimeOffPolicyRepository } from './repository/type-orm-time-off-policy.repository';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';

@Injectable()
export class TimeOffPolicyService extends TenantAwareCrudService<TimeOffPolicy> {
	constructor(
		@InjectRepository(TimeOffPolicy)
		typeOrmTimeOffPolicyRepository: TypeOrmTimeOffPolicyRepository,

		mikroOrmTimeOffPolicyRepository: MikroOrmTimeOffPolicyRepository,

		@InjectRepository(Employee)
		private typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {
		super(typeOrmTimeOffPolicyRepository, mikroOrmTimeOffPolicyRepository);
	}

	async create(entity: ITimeOffPolicyCreateInput): Promise<TimeOffPolicy> {
		const policy = new TimeOffPolicy();

		policy.name = entity.name;
		policy.organizationId = entity.organizationId;
		policy.tenantId = entity.tenantId;
		policy.requiresApproval = entity.requiresApproval;
		policy.paid = entity.paid;

		const employees = await this.typeOrmEmployeeRepository.find({
			where: {
				id: In(entity.employees)
			},
			relations: {
				user: true
			}
		});
		policy.employees = employees;
		return this.typeOrmRepository.save(policy);
	}

	async update(id: string, entity: ITimeOffPolicyUpdateInput): Promise<TimeOffPolicy> {
		try {
			await this.typeOrmRepository.delete(id);
			const policy = new TimeOffPolicy();

			policy.name = entity.name;
			policy.organizationId = entity.organizationId;
			policy.tenantId = entity.tenantId;
			policy.requiresApproval = entity.requiresApproval;
			policy.paid = entity.paid;

			const employees = await this.typeOrmEmployeeRepository.find({
				where: {
					id: In(entity.employees)
				},
				relations: {
					user: true
				}
			});
			policy.employees = employees;
			return this.typeOrmRepository.save(policy);
		} catch (err /*: WriteError*/) {
			throw new BadRequestException(err);
		}
	}
}
