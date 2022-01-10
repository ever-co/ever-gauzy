import { ClassConstructor } from 'class-transformer';
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';
import * as moment from 'moment';

export const IsBeforeDate = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions) => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: IsBeforeConstraint,
        });
    };
};


@ValidatorConstraint({ name: "isBeforeDate", async: false })
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