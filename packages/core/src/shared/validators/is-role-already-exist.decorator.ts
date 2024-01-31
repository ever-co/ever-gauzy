import { registerDecorator, ValidationOptions } from "class-validator";
import { RoleAlreadyExistConstraint } from "./constraints";

/**
 * Decorator Factory: Checks if a role already exists.
 *
 * @param validationOptions - Validation options for the decorator.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsRoleAlreadyExist = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: RoleAlreadyExistConstraint,
		});
	};
}
