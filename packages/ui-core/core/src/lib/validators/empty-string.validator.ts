import { AbstractControl, ValidationErrors } from '@angular/forms';

export function emptyStringValidator(control: AbstractControl): ValidationErrors | null {
	const isEmptyString = (control.value || '').trim().length === 0;
	return isEmptyString ? { whitespace: true } : null;
}
