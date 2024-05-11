import { AbstractControl, ValidatorFn } from '@angular/forms';
import { hasRequiredField } from './has-required';

export class CompareDateValidator {
	/**
	 * Validates the date range between two form fields.
	 * @param fromField The name of the 'from' date form control.
	 * @param toField The name of the 'to' date form control.
	 * @returns A validator function that returns an object if validation fails, or null if validation succeeds.
	 */
	static validateDate(fromField: string, toField: string): ValidatorFn {
		return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
			const fromDate = formGroup.get(fromField);
			const toDate = formGroup.get(toField);

			// Check if both 'from' and 'to' dates are not null and 'from' date is after 'to' date
			if (fromDate.value !== null && toDate.value !== null && fromDate.value > toDate.value) {
				// Set error on 'to' date control and return error object
				toDate.setErrors({ invalid: true });
				return { [toField]: true };
			}

			// Check if 'from' date control has a required field error
			if (hasRequiredField(fromDate)) {
				fromDate.setErrors({ required: true });
			} else {
				// Clear any existing errors on 'from' date control
				fromDate.setErrors(null);
			}

			// Check if 'to' date control has a required field error
			if (hasRequiredField(toDate)) {
				toDate.setErrors({ required: true });
			} else {
				// Clear any existing errors on 'to' date control
				toDate.setErrors(null);
			}

			// If validation passes, return null
			return null;
		};
	}
}
