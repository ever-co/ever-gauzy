import { registerDecorator, ValidationOptions } from "class-validator";
import { RoleShouldExistConstraint } from "./constraints";

/**
 * Custom validation decorator factory for checking if a role should exist.
 *
 * @param validationOptions - Validation options.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsRoleShouldExist = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: RoleShouldExistConstraint,
		});
	};
};
