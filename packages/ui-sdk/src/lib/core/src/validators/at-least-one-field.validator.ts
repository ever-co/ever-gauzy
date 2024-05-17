import { AbstractControl, UntypedFormGroup } from '@angular/forms';
import { isNotNullOrUndefined } from '@gauzy/ui-sdk/common';

/**
 * Validates that at least one field in the group has a valid, non-null, and non-undefined value.
 *
 * @param group - The form group to validate.
 * @returns A validation error object if no valid value is found in the group, otherwise null.
 */
export function AtLeastOneFieldValidator(group: UntypedFormGroup): { [key: string]: any } {
	if (!group || !group.controls) {
		return { requiredAtLeastOne: true };
	}

	const hasValidValue = Object.values(group.controls).some(
		(control: AbstractControl) => control.valid && isNotNullOrUndefined(control.value)
	);

	return hasValidValue ? null : { requiredAtLeastOne: true };
}
