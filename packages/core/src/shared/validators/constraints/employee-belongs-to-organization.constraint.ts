import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IEmployee } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { Employee } from "../../../core/entities/internal";
import { RequestContext } from "../../../core/context";
import { TypeOrmEmployeeRepository } from "../../../employee/repository/type-orm-employee.repository";
import { MikroOrmEmployeeRepository } from "../../../employee/repository/mikro-orm-employee.repository";

/**
 * Validator constraint for employee belonging to organization validation.
 */
@ValidatorConstraint({ name: "IsEmployeeBelongsToOrganization", async: true })
@Injectable()
export class EmployeeBelongsToOrganizationConstraint implements ValidatorConstraintInterface {

	constructor(
		@InjectRepository(Employee)
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) { }

	/**
	 * Validates if the employee belongs to the organization.
	 * @param value - The value to be validated (employee ID or employee object).
	 * @param args - Validation arguments containing the object.
	 * @returns {Promise<boolean>} - True if the employee belongs to the organization, otherwise false.
	 */
	async validate(value: IEmployee['id'] | IEmployee, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(value)) { return true; }

		const employeeId: string = (typeof value === 'string') ? value : value.id;
		const object: object = args.object;

		try {
			if (object['organizationId'] || object['organization']['id']) {
				const organizationId = object['organizationId'] || object['organization']['id'];
				return !!await this.typeOrmEmployeeRepository.findOneByOrFail({
					id: employeeId,
					organizationId,
					tenantId: RequestContext.currentTenantId()
				});
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Gets default message when validation for this constraint fail.
	 */
	defaultMessage(validationArguments?: ValidationArguments): string {
		const { value } = validationArguments;
		return `This employee (${JSON.stringify(value)}) is not belongs to this organization.`;
	}
}
