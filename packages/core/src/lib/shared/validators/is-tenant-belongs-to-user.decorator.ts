import { registerDecorator, ValidationOptions } from "class-validator";
import { TenantBelongsToUserConstraint } from "./constraints";

/**
 * Tenant should belongs to user validation decorator
 *
 * @param validationOptions
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsTenantBelongsToUser = (validationOptions?: ValidationOptions): PropertyDecorator => {
	return (object: Object, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: TenantBelongsToUserConstraint,
		});
	};
}
