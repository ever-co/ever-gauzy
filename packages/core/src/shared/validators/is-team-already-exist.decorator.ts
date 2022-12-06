import { registerDecorator, ValidationOptions } from "class-validator";
import { IsTeamAlreadyExistConstraint } from "./constraints";

/**
 * Organization team already existed validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsTeamAlreadyExist = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsTeamAlreadyExistConstraint,
		});
    };
}