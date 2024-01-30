import { registerDecorator, ValidationOptions } from "class-validator";
import { IsRoleAlreadyExistConstraint } from "./constraints";

/**
 * Decorator Factory: Checks if a role already exists.
 *
 * @param validationOptions - Validation options for the decorator.
 * @returns Decorator function.
 */
export const IsRoleAlreadyExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleAlreadyExistConstraint,
		});
	};
};
