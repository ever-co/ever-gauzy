import { ClassConstructor } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsBeforeConstraint } from './constraints';

/**
 * Is before date check validation decorator
 *
 * @param type
 * @param property
 * @param validationOptions
 * @returns
 */
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