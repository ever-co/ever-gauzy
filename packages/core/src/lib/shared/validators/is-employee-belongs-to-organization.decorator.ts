import { registerDecorator, ValidationOptions } from "class-validator";
import { EmployeeBelongsToOrganizationConstraint } from "./constraints";

/**
 * Decorator to validate if an employee belongs to the organization for a specific tenant.
 *
 * @param validationOptions - Options for validation.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsEmployeeBelongsToOrganization = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: EmployeeBelongsToOrganizationConstraint,
		});
	};
}
