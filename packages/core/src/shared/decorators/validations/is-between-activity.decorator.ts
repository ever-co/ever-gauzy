import { ClassConstructor } from "class-transformer";
import { ValidationOptions, registerDecorator } from "class-validator";
import { IsBetweenActivtyConstraint } from "./constraints";


/**
 * Is between activity check validation decorator
 *
 * @param type
 * @param property
 * @param validationOptions
 * @returns
 */
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