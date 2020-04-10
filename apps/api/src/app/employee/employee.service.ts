import { EmployeeCreateInput } from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Employee } from './employee.entity';
import { CrudService } from '../core/crud/crud.service';
import * as moment from 'moment';

@Injectable()
export class EmployeeService extends CrudService<Employee> {
	constructor(
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(employeeRepository);
	}

	async createBulk(input: EmployeeCreateInput[]) {
		return await this.repository.save(input);
	}

	/**
	 * Find the employees working in the organization for a particular month.
	 * An employee is considered to be 'working' if:
	 * 1. The startedWorkOn date is (not null and) less than the last day forMonth
	 * 2. The endWork date is either null or greater than the first day forMonth
	 * @param organizationId  The organization id of the employees to find
	 * @param forMonth  Only the month & year is considered
	 */
	async findWorkingEmployees(
		organizationId: string,
		forMonth: Date,
		withUser: boolean
	): Promise<{ total: number; items: Employee[] }> {
		let query = await this.repository
			.createQueryBuilder('employee')
			.where('"employee"."organizationId" = :organizationId', {
				organizationId
			})
			.andWhere('"employee"."startedWorkOn" <= :startedWorkOnCondition', {
				startedWorkOnCondition: moment(forMonth)
					.endOf('month')
					.toDate()
			})
			.andWhere(
				new Brackets((notEndedCondition) => {
					notEndedCondition
						.where('"employee"."endWork" IS NULL')
						.orWhere(
							'"employee"."endWork" >= :endWorkOnCondition',
							{
								endWorkOnCondition: moment(forMonth)
									.startOf('month')
									.toDate()
							}
						);
				})
			);

		if (withUser) {
			query = query.leftJoinAndSelect('employee.user', 'user');
		}

		const [items, total] = await query.getManyAndCount();
		return {
			total,
			items
		};
	}
}
