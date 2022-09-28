import { registerDecorator, ValidationOptions } from "class-validator";
import { IsOrganizationBelongsToUserConstraint } from "./constraints";

/**
 * Organization should belongs to user validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsOrganizationBelongsToUser = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsOrganizationBelongsToUserConstraint,
		});
    };
}