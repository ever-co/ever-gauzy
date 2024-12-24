import { registerDecorator, ValidationOptions } from "class-validator";
import { OrganizationBelongsToUserConstraint } from "./constraints";

/**
 * Organization should belongs to user validation decorator
 *
 * @param validationOptions
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsOrganizationBelongsToUser = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: OrganizationBelongsToUserConstraint,
		});
	};
}
