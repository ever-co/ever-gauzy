import { registerDecorator, ValidationOptions } from "class-validator";
import { TeamAlreadyExistConstraint } from "./constraints";

/**
 * Custom validation decorator factory for checking if a team already exists.
 *
 * @param validationOptions - Validation options.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsTeamAlreadyExist = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: TeamAlreadyExistConstraint,
		});
	};
}
