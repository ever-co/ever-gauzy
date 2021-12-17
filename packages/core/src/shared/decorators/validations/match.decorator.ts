import { ClassConstructor } from 'class-transformer';
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';

export const Match = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions) => {
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


@ValidatorConstraint({ name: "Match" })
export class MatchConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments) {
        const [fn] = args.constraints;
        return fn(args.object) === value;
    }

    defaultMessage(args: ValidationArguments) {
        return `The password and confirmation password do not match.`;
    }
}