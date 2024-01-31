import { ClassConstructor } from 'class-transformer';
import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import * as moment from 'moment';

/**
 *
 * @param type
 * @param property
 * @param validationOptions
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsBeforeDate = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions): PropertyDecorator => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: BeforeDateConstraint,
        });
    };
};

/**
 * Is before date check validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsBeforeDate", async: false })
export class BeforeDateConstraint implements ValidatorConstraintInterface {

    /**
     * Validate if the start date is before the end date.
     *
     * @param value - The date to be validated.
     * @param args - Validation arguments, including constraints.
     * @returns {boolean} - Returns `true` if the start date is before the end date; otherwise, `false`.
     */
    validate(value: Date, args: ValidationArguments): boolean {
        const [fn] = args.constraints;

        // Check for undefined, null, or invalid function
        if (!value || !fn || typeof fn !== 'function') {
            return false;
        }

        // Convert dates to moment objects
        const start: moment.Moment = moment(value);
        const end: moment.Moment = moment(fn(args.object));

        // Check if both dates are valid
        if (!start.isValid() || !end.isValid()) {
            return false;
        }

        // Perform the validation
        return start.isBefore(end);
    }

    /**
     * Get the default error message for the IsBeforeDate constraint.
     *
     * @param args - Validation arguments.
     * @returns {string} - The default error message.
     */
    defaultMessage(args: ValidationArguments): string {
        const { value } = args;
        return `The start date "${value}" must be before the end date.`;
    }
}
