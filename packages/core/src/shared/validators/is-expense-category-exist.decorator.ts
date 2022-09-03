import { registerDecorator, ValidationOptions } from "class-validator";
import { IsExpenseCategoryAlreadyExistConstraint } from "./constraints";

/**
 * Expense category already existed validation decorator
 *
 * @param validationOptions
 * @returns
 */
export const IsExpenseCategoryAlreadyExist = (validationOptions?: ValidationOptions) => {
    return (object: any, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsExpenseCategoryAlreadyExistConstraint,
        });
    };
};