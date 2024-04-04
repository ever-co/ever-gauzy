import { Injectable } from "@nestjs/common";
import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from "class-validator";
import { IEmployee } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { RequestContext } from "../../../core/context";
import { MultiORM, MultiORMEnum, getORMType } from "../../../core/utils";
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from "../../../employee/repository";

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Validator constraint for employee belonging to organization validation.
 */
@ValidatorConstraint({ name: "IsEmployeeBelongsToOrganization", async: true })
@Injectable()
export class EmployeeBelongsToOrganizationConstraint implements ValidatorConstraintInterface {

	constructor(
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository
	) { }

	/**
	 * Validates if the employee belongs to the organization.
	 * @param value - The employee ID or employee object.
	 * @param args - Validation arguments containing the object with organization details.
	 * @returns {Promise<boolean>} - True if the employee belongs to the organization, otherwise false.
	 */
	async validate(value: IEmployee['id'] | IEmployee, args: ValidationArguments): Promise<boolean> {
		if (isEmpty(value)) return true;

		const employeeId: string = typeof value === 'string' ? value : value.id;
		const object = args.object as { organizationId?: string, organization?: { id: string } };

		const organizationId = object.organizationId || object.organization?.id;
		if (!organizationId) return true; // No organization ID provided

		try {
			const tenantId = RequestContext.currentTenantId();
			return !!await this.findOneByOrFail(employeeId, organizationId, tenantId);
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
	private async findOneByOrFail(employeeId: string, organizationId: string, tenantId: string): Promise<IEmployee | undefined> {
		switch (ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.findOneOrFail({ id: employeeId, organizationId, tenantId });
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmployeeRepository.findOneByOrFail({ id: employeeId, organizationId, tenantId });
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
