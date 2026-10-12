import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/** Shape a monetary or quantity operand must have: an exact decimal, never an exponent and never a float literal. */
const DECIMAL_PATTERN = /^[+-]?\d{1,14}(\.\d{1,6})?$/;

/**
 * Accepts a value that is an exact decimal.
 *
 * Money is an exact decimal, never a binary floating point number: `0.1`, `24.99` and `0.15` have no
 * exact double representation, and the representation error becomes observable the moment a total is
 * rounded and stored. A request may therefore carry the decimal either as a string (`"24.99"`, the
 * form the API documents) or as a JSON number that is exactly representable within the storage scale;
 * anything else — `NaN`, `Infinity`, an exponent, more than six fractional digits — is rejected here
 * rather than silently rounded later.
 *
 * @param validationOptions Standard class-validator options.
 * @returns The property decorator.
 */
export function IsDecimalAmount(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: 'isDecimalAmount',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					if (typeof value === 'string') {
						return DECIMAL_PATTERN.test(value.trim());
					}

					if (typeof value === 'number') {
						return Number.isFinite(value) && DECIMAL_PATTERN.test(String(value));
					}

					return false;
				},
				defaultMessage(args: ValidationArguments): string {
					return `${args.property} must be an exact decimal amount with at most six fractional digits`;
				}
			}
		});
	};
}
