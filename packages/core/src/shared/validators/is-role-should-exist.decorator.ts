import { registerDecorator, ValidationOptions } from "class-validator";
import { IsRoleShouldExistConstraint } from "./constraints";

/**
 * Role should existed validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsRoleShouldExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleShouldExistConstraint,
		});
    };
}