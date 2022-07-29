import {
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator';

/**
 * Match two fields value constraint
 */
@ValidatorConstraint({ name: "Match" })
export class IsMatchConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments) {
        const [fn] = args.constraints;
        return fn(args.object) === value;
    }

    defaultMessage(args: ValidationArguments) {
        return `The password and confirmation password do not match.`;
    }
}