import { AbstractControl, ValidatorFn } from '@angular/forms';
import { isEmpty } from '@gauzy/ui-sdk/common';
import { patterns } from './regex-patterns.const';

export class EmailValidator {
	/**
	 * Validate emails based on the provided pattern.
	 * @param field The name of the email form control.
	 * @returns A validator function to validate the email field.
	 */
	static pattern(field: string): ValidatorFn {
		return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
			const control = formGroup.get(field);
			if (!control) return null;

			return EmailValidator.validator(control, patterns.email);
		};
	}

	/**
	 * Validate emails based on the provided pattern.
	 * @param control The form control to validate.
	 * @param pattern The regular expression pattern to match against.
	 * @returns An object containing validation errors, or null if validation passes.
	 */
	static validator(control: AbstractControl, pattern: RegExp) {
		const value = control.value;
		if (isEmpty(value)) {
			control.setErrors({ required: true });
			return { emailValid: false };
		}

		control.markAsTouched();

		const isValid = value.every((email: string) => EmailValidator.isValid(email, pattern));
		if (!isValid) {
			control.setErrors({ invalid: true });
			return { emailValid: false };
		}

		control.setErrors(null);
		return null;
	}

	/**
	 * Check if the email is valid based on the provided RegExp pattern.
	 * @param email The email to validate.
	 * @param regExp The RegExp pattern to match against.
	 * @returns True if the email is valid, otherwise false.
	 */
	static isValid(email: string, regExp: RegExp): boolean {
		try {
			return regExp.test(email);
		} catch (error) {
			return false;
		}
	}
}
