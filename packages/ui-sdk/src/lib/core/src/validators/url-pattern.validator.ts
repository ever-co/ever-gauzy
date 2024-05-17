import { AbstractControl, ValidatorFn } from '@angular/forms';
import { patterns } from './regex-patterns.const';

export class UrlPatternValidator {
	/**
	 * Validate website URLs based on the provided pattern.
	 * @param field The name of the website URL form control.
	 * @returns A validator function to validate the website URL field.
	 */
	static websiteUrlValidator(field: string): ValidatorFn {
		return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
			const control = formGroup.get(field);
			return UrlPatternValidator.urlAbstractValidator(control, patterns.websiteUrl);
		};
	}

	/**
	 * Validate image URLs based on the provided pattern.
	 * @param field The name of the image URL form control.
	 * @returns A validator function to validate the image URL field.
	 */
	static imageUrlValidator(field: string): ValidatorFn {
		return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
			const control = formGroup.get(field);
			return UrlPatternValidator.urlAbstractValidator(control, patterns.imageUrl);
		};
	}

	/**
	 * Validate URLs based on the provided pattern.
	 * @param control The form control to validate.
	 * @param pattern The regular expression pattern to match against.
	 * @returns An object containing validation errors, or null if validation passes.
	 */
	static urlAbstractValidator(control: AbstractControl, pattern: RegExp) {
		if (control.value && !UrlPatternValidator.isValidUrl(control.value, pattern)) {
			control.setErrors({ invalid: true });
			return { urlValid: false };
		}
		control.setErrors(null);
		return null;
	}

	/**
	 * Check if the URL is valid based on the provided RegExp pattern.
	 * @param urlString The URL to validate.
	 * @param regExp The RegExp pattern to match against.
	 * @returns True if the URL is valid, otherwise false.
	 */
	static isValidUrl(urlString: string, regExp: RegExp): boolean {
		try {
			return new RegExp(regExp).test(urlString);
		} catch (error) {
			return false;
		}
	}
}
