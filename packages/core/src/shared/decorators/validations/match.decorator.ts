import { ClassConstructor } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsMatchConstraint } from './constraints';

/**
 * Match two fields value decorator
 *
 * @param type
 * @param property
 * @param validationOptions
 * @returns
 */
export const Match = <T>(type: ClassConstructor<T>, property: (o: T) => any, validationOptions?: ValidationOptions) => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [property],
            validator: IsMatchConstraint,
        });
    };
};