import { registerDecorator, ValidationOptions } from "class-validator";
import { ExpenseCategoryAlreadyExistConstraint } from "./constraints";

/**
 * Expense category existence validation decorator.
 *
 * @param validationOptions - Options for the validation decorator.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsExpenseCategoryAlreadyExist = (validationOptions?: ValidationOptions): PropertyDecorator => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: ExpenseCategoryAlreadyExistConstraint,
        });
    };
};
