import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export function length(text: string, length: number): boolean {
    return (typeof text === 'string' && typeof length === 'number') && (text.length == length);
}

/**
 * Custom length validation decorator.
 *
 * @param length - The expected length of the property.
 * @param validationOptions - Options for the validation decorator.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const CustomLength = (length: number = 6, validationOptions?: ValidationOptions): PropertyDecorator => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [length],
            validator: CustomLengthConstraint,
        });
    };
};

/**
 * Validator constraint for custom length validation.
 */
@ValidatorConstraint({ name: "CustomLength", async: false })
export class CustomLengthConstraint implements ValidatorConstraintInterface {
    /**
     * Validates the length of the provided value.
     * @param value - The value to be validated.
     * @param args - Validation arguments containing constraints.
     * @returns {boolean} - True if the length is within the specified constraints, otherwise false.
     */
    validate(value: string, args: ValidationArguments): boolean {
        if (!value) return true;
        return length(value, args.constraints[0]);
    }

    /**
     * Returns the default error message for the custom length validation.
     * @param validationArguments - Validation arguments containing the value.
     * @returns {string} - Default error message.
     */
    defaultMessage(validationArguments: ValidationArguments): string {
        const { value } = validationArguments;
        return `(${value}) is too short or too long!`;
    }
}
