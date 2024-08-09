import { AbstractControl } from '@angular/forms';

/**
 * Checks if a form control has a required field error.
 * @param control The form control to check.
 * @returns True if the control has a required field error, otherwise false.
 */
export const hasRequiredField = (control: AbstractControl): boolean => {
	// Check if the control exists
	if (!control) {
		return false;
	}
	// Check if the control has a validator
	if (!control.validator) {
		return false;
	}
	// Check if the control has a 'required' error
	return !!(control.errors && control.errors['required']);
};
