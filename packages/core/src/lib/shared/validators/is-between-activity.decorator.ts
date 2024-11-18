import { ClassConstructor } from 'class-transformer';
import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator
} from 'class-validator';

/**
 * IsBetweenActivity custom decorator.
 *
 * @param validationOptions - Validation options.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsBetweenActivity = <T>(
	type: ClassConstructor<T>,
	property: (o: T) => any,
	validationOptions?: ValidationOptions
): PropertyDecorator => {
	return (object: any, propertyName: string) => {
		registerDecorator({
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [property],
			validator: BetweenActivityConstraint
		});
	};
};

/**
 * Is between activity check validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: 'IsBetweenActivity', async: false })
export class BetweenActivityConstraint implements ValidatorConstraintInterface {
	/**
	 * Validate if the start and end values in the activityLevel object are between 0 and 100 (inclusive).
	 *
	 * @param activityLevel - The object containing start and end properties to be validated.
	 * @param args - Validation arguments.
	 * @returns {boolean} - Returns `true` if both start and end values are between 0 and 100 (inclusive); otherwise, `false`.
	 */
	validate(
		activityLevel: {
			start: number;
			end: number;
		},
		args: ValidationArguments
	): boolean {
		const { start, end } = activityLevel;

		// Check if start and end values are within the range [0, 100]
		return start >= 0 && end <= 100;
	}

	/**
	 * Get the default error message for the IsBetweenActivity constraint.
	 *
	 * @param args - Validation arguments.
	 * @returns {string} - The default error message.
	 */
	defaultMessage(args: ValidationArguments): string {
		return 'Start & End must be between 0 and 100';
	}
}
