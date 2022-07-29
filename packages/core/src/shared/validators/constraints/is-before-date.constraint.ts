import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';
import * as moment from 'moment';

/**
 * Is before date check validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsBeforeDate", async: false })
export class IsBeforeConstraint implements ValidatorConstraintInterface {
    validate(value: Date, args: ValidationArguments) {
        const [fn] = args.constraints;
        let start: any = moment(value);
        let end: any = moment(fn(args.object));

        if (!start.isValid() || !end.isValid()) {
            return false;
        }
        return start.isBefore(end);
    }

    defaultMessage(args: ValidationArguments) {
        return "Start date must be before End date";
    }
}