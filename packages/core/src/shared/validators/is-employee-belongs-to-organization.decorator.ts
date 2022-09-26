import { registerDecorator, ValidationOptions } from "class-validator";
import { IsEmployeeBelongsToOrganizationConstraint } from "./constraints";

/**
 * Is employee should belongs to organization for specific tenant validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsEmployeeBelongsToOrganization = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsEmployeeBelongsToOrganizationConstraint,
		});
    };
}