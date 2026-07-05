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
	// NOTE: the linked user's `email` is intentionally NOT exposed on the unauthenticated public
	// profile (GDPR-relevant PII); only display name + avatar are returned (GHSA-49ff-8859-537j).
	user: {
		id: true,
		firstName: true,
		lastName: true,
		imageUrl: true
	}
};

/**
 * Applies the employee's own `show_*` visibility flags server-side: financial fields are removed from
 * the response unless the employee has explicitly opted to display them. The `show_*` flags only
 * control UI rendering, so without this an unauthenticated caller could still read raw values the
 * employee chose to hide (GHSA-49ff-8859-537j).
 *
 * @param employee - The loaded (already field-projected) employee.
 * @returns The same employee with hidden financial fields stripped.
 */
function applyEmployeeVisibility<T extends Partial<IEmployee>>(employee: T): T {
	if (!employee) {
		return employee;
	}
	const e = employee as Record<string, any>;
	if (!e['show_billrate']) {
		delete e['billRateValue'];
		delete e['billRateCurrency'];
	}
	if (!e['show_payperiod']) {
		delete e['payPeriod'];
	}
	if (!e['show_start_work_on']) {
		delete e['startedWorkOn'];
	}
	if (!e['show_average_income']) {
		delete e['averageIncome'];
	}
	if (!e['show_average_expenses']) {
		delete e['averageExpenses'];
	}
	if (!e['show_average_bonus']) {
		delete e['averageBonus'];
	}
	return employee;
}

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
			return { items: items.map(applyEmployeeVisibility), total };
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
            const employee = await this.typeOrmEmployeeRepository.findOneOrFail({
				where,
				relations,
				// Restrict the response to display-safe fields only (GHSA-49ff-8859-537j).
				select: PUBLIC_EMPLOYEE_SELECT
			});
			return applyEmployeeVisibility(employee);
		} catch (error) {
			throw new NotFoundException(`The requested record was not found`);
		}
	}
}
