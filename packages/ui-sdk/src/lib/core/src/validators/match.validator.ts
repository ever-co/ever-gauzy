import { AbstractControl, ValidatorFn } from '@angular/forms';
import { isNotEmpty } from '@gauzy/ui-sdk/common';

/**
 * custom validator to check that two fields match
 */
export class MatchValidator {
	/**
	 * Custom validator to check that two fields match.
	 * @param controlName The name of the first form control.
	 * @param matchingControlName The name of the second form control to compare against.
	 * @returns A validator function to validate the matching of the two fields.
	 */
	static mustMatch(controlName: string, matchingControlName: string): ValidatorFn {
		return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
			const control = formGroup.get(controlName);
			const matchingControl = formGroup.get(matchingControlName);

			// set error on matchingControl if validation fails
			if (isNotEmpty(control.value) && control.value !== matchingControl.value) {
				matchingControl.setErrors({ mustMatch: true });
			} else {
				matchingControl.setErrors(null);
			}

			return null;
		};
	}
}
