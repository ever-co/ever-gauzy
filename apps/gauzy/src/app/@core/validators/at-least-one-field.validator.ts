import { UntypedFormGroup } from '@angular/forms';
import { isNotNullOrUndefined } from '@gauzy/common-angular';

/**
 * Validates that at least one field in the group has a valid, non-null, and non-undefined value.
 *
 * @param group - The form group to validate.
 * @returns A validation error object if no valid value is found in the group, otherwise null.
 */
export function AtLeastOneFieldValidator(group: UntypedFormGroup): { [key: string]: any } {
	let isAtLeastOne = false;

	if (group && group.controls) {
		for (const control in group.controls) {
			if (
				group.controls.hasOwnProperty(control) &&
				group.controls[control].valid &&
				isNotNullOrUndefined(group.controls[control].value)
			) {
				isAtLeastOne = true;
				break;
			}
		}
	}

	return isAtLeastOne ? null : { requiredAtLeastOne: true };
}
