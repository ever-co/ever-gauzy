import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from "class-validator";

/**
 * Is between activity check validation constraint
 *
 * @param validationOptions
 * @returns
 */
@ValidatorConstraint({ name: "IsBetweenActivty", async: false })
export class IsBetweenActivtyConstraint implements ValidatorConstraintInterface {
    validate(activityLevel: {
        start: number;
        end: number;
    }, args: ValidationArguments) {
        const { start, end } = activityLevel;
        return (start >= 0) && (end <= 100);
    }

    defaultMessage(args: ValidationArguments) {
        return "Start & End must be between 0 and 100";
    }
}