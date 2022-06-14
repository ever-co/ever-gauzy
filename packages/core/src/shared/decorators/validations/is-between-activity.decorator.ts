import { ClassConstructor } from "class-transformer";
import {
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator
} from "class-validator";

export const IsBetweenActivty = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions) => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: IsBetweenActivtyConstraint,
        });
    };
};

@ValidatorConstraint({ name: "isBetweenActivty", async: false })
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