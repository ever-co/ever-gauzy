import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { Employee } from './../../core/entities/internal';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';

/**
 * Display-safe field allowlist for the public employee profile.
 *
 * The public endpoints must NOT return the entire Employee entity (internal ids, job-search status,
 * offer/accept/reject dates, totals, etc.) nor the linked user's private fields (phoneNumber,
 * username, ...). Only the fields the public profile page actually renders are exposed
 * (GHSA-49ff-8859-537j). The virtual `name` column is intentionally omitted from the user
 * projection — it is repopulated from firstName/lastName by the UserSubscriber after load. Any
 * relations the caller requests (skills, awards, organizationEmploymentTypes) are not keyed here, so
 * TypeORM still loads them in full.
 */
const PUBLIC_EMPLOYEE_SELECT: FindOptionsSelect<Employee> = {
	id: true,
	isActive: true,
	short_description: true,
	payPeriod: true,
	billRateValue: true,
	billRateCurrency: true,
	averageIncome: true,
	averageExpenses: true,
	averageBonus: true,
	startedWorkOn: true,
	show_billrate: true,
	show_payperiod: true,
	show_start_work_on: true,
	show_average_income: true,
	show_average_expenses: true,
	show_average_bonus: true,
	organizationId: true,
	user: {
		id: true,
		firstName: true,
		lastName: true,
		email: true,
		imageUrl: true
	}
};

@Injectable()
export class PublicEmployeeService {
	constructor(
		@InjectRepository(Employee)
		private typeOrmEmployeeRepository: TypeOrmEmployeeRepository
	) {}

	/**
	 * GET all public employees by organization condition
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async findPublicEmployeeByOrganization(
		where: FindOptionsWhere<Employee>,
		relations: string[] = []
	): Promise<IPagination<IEmployee>> {
		try {
			// TODO(typeorm-v1): `relations` no longer accepts a string array. This value references a variable whose shape can't be determined statically — if it holds `string[]`, wrap it: `Object.fromEntries(<expr>?.map(r => [r, true]) ?? [])` (dot-paths need extra nesting handling). If it already holds the v1 object shape, no change needed.
            const [items = [], total = 0] = await this.typeOrmEmployeeRepository.findAndCount({
				where,
				relations,
				// Restrict the response to display-safe fields only (GHSA-49ff-8859-537j).
				select: PUBLIC_EMPLOYEE_SELECT
			});
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error, `Error while getting public employees`);
		}
	}

	/**
	 * GET employee by profile link & primary ID
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	async findOneByConditions(where: FindOptionsWhere<Employee>, relations: string[]): Promise<IEmployee> {
		try {
			// TODO(typeorm-v1): `relations` no longer accepts a string array. This value references a variable whose shape can't be determined statically — if it holds `string[]`, wrap it: `Object.fromEntries(<expr>?.map(r => [r, true]) ?? [])` (dot-paths need extra nesting handling). If it already holds the v1 object shape, no change needed.
            return await this.typeOrmEmployeeRepository.findOneOrFail({
				where,
				relations,
				// Restrict the response to display-safe fields only (GHSA-49ff-8859-537j).
				select: PUBLIC_EMPLOYEE_SELECT
			});
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
