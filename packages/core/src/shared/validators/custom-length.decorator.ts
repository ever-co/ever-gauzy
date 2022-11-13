import { registerDecorator, ValidationOptions } from 'class-validator';
import { CustomLengthConstraint } from './constraints';

export const CustomLength = (length: number = 6, validationOptions?: ValidationOptions): PropertyDecorator => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [length],
            validator: CustomLengthConstraint,
        });
    };
};