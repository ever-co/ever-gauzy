import { ClassConstructor } from 'class-transformer';
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';

/**
 * Match two fields value decorator
 *
 * @param type
 * @param property
 * @param validationOptions
 * @returns {PropertyDecorator} - Decorator function.
 */
export const Match = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions): PropertyDecorator => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: MatchConstraint,
        });
    };
};

/**
 * Match two fields value constraint.
 */
@ValidatorConstraint({ name: 'Match' })
export class MatchConstraint implements ValidatorConstraintInterface {
    /**
     * Validate if the value matches another field's value.
     *
     * @param value - The value to validate.
     * @param args - Validation arguments.
     * @returns {boolean} - Indicates whether the validation passed.
     */
    validate(value: any, args: ValidationArguments): boolean {
        const [fn] = args.constraints;
        return fn(args.object) === value;
    }

    /**
     * Gets the default validation error message.
     *
     * @param args - Validation arguments.
     * @returns {string} - The default error message.
     */
    defaultMessage(args: ValidationArguments): string {
        return 'The values do not match.';
    }
}
