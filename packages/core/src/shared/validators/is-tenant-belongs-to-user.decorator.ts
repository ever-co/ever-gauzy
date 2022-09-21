import { registerDecorator, ValidationOptions } from "class-validator";
import { IsTenantBelongsToUserConstraint } from "./constraints";

/**
 * Tenant should belongs to user validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsTenantBelongsToUser = (validationOptions?: ValidationOptions) => {
	return (object: Object, propertyName: string) => {
        registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: IsTenantBelongsToUserConstraint,
		});
    };
}