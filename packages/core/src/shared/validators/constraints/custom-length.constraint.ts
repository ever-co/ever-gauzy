import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

export function length(text: number, length: number): boolean {
    return (typeof text === 'number' && typeof length === 'number') && (text.toString().length == length);
}

@ValidatorConstraint({ name: "CustomLength", async: false })
export class CustomLengthConstraint implements ValidatorConstraintInterface {

	validate(value: number, args: ValidationArguments) {
        if (!value) return true;

        return length(value, args.constraints[0]);
	}

    defaultMessage(validationArguments: ValidationArguments) {
        const { value } = validationArguments;
        return `(${value}) is too short or too long!`;
    }
}