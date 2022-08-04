import { registerDecorator, ValidationOptions } from "class-validator";
import { IsRoleAlreadyExistConstraint } from "./constraints";

/**
 * Role already existed validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsRoleAlreadyExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsRoleAlreadyExistConstraint,
		});
    };
}