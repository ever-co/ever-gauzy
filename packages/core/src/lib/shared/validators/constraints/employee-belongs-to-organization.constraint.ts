import { Injectable } from '@nestjs/common';
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ID, IEmployee } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { RequestContext } from '../../../core/context';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { TypeOrmEmployeeRepository } from '../../../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../../../employee/repository/mikro-orm-employee.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Validator constraint for employee belonging to organization validation.
 */
@ValidatorConstraint({ name: 'IsEmployeeBelongsToOrganization', async: true })
@Injectable()
export class EmployeeBelongsToOrganizationConstraint implements ValidatorConstraintInterface {
	constructor(
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) {}

	/**
	 * Validates if the employee belongs to the organization.
	 * @param value - The employee ID or employee object.
	 * @param args - Validation arguments containing the object with organization details.
	 * @returns {Promise<boolean>} - True if the employee belongs to the organization, otherwise false.
	 */
	async validate(value: ID | IEmployee, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(value)) return true;

		const employeeId: string = typeof value === 'string' ? value : value?.id;

		// The UI ships an ALL_EMPLOYEES_SELECTED sentinel (`{ id: null, firstName: 'All Employees', ... }`)
		// whenever no concrete employee is picked, so `value` can be a NON-empty object carrying an EMPTY
		// id — the `isEmpty(value)` early-out above does not catch that shape. There is no employee to
		// validate in that case: the record is organization-level and `employeeId` is legitimately null.
		// Never issue the lookup with an empty id — `findOneByOrFail({ id: null, ... })` used to have its
		// `id` predicate silently dropped and matched the FIRST employee of the organization (the exact
		// widening GHSA-44pv-34gx-q9p4 closed); it now compiles to `id IS NULL`, finds nothing, and
		// rejects a perfectly legal org-level record with a 400.
		if (isEmpty(employeeId)) {
			return true;
		}

		const object = args.object as { organizationId?: string; organization?: { id: string } };

		const organizationId = object.organizationId || object.organization?.id;
		if (!organizationId) return true; // No organization ID provided

		try {
			const tenantId = RequestContext.currentTenantId();
			// Fetch the employee from the database using the provided employee ID and organization ID
			return !!(await this.findOneByOrFail(employeeId, organizationId, tenantId));
		} catch (error) {
			// Handle different types of errors if needed, for now assuming not found means false
			return false;
		}
	}

	/**
	 * Fetches an employee entity based on the employee ID, organization ID, and tenant ID.
	 * It uses the appropriate ORM repository to perform the find operation.
	 *
	 * @param employeeId - The ID of the employee.
	 * @param organizationId - The ID of the organization the employee belongs to.
	 * @param tenantId - The tenant ID.
	 * @returns A Promise that resolves to the employee entity if found, or undefined.
	 */
	private async findOneByOrFail(employeeId: ID, organizationId: ID, tenantId: ID): Promise<IEmployee | undefined> {
		// Create a where clause for the employee
		const whereClause = {
			id: employeeId,
			organizationId,
			tenantId
		};

		// Use the appropriate ORM repository based on the type of the application
		switch (ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.findOneOrFail(whereClause);
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmployeeRepository.findOneByOrFail(whereClause);
			default:
				throw new Error(`Not implemented for ${ormType}`);
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `This employee (${JSON.stringify(value)}) does not belong to the specified organization.`;
	}
}
