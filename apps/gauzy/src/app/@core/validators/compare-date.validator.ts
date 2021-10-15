import { AbstractControl, ValidatorFn } from "@angular/forms";

export class CompareDateValidator {
    static validateDate(fromField: string, toField: string): ValidatorFn {
        return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
            const fromDate = formGroup.get(fromField);
            const toDate = formGroup.get(toField);

            if ((fromDate.value !== null && toDate.value !== null) && fromDate.value > toDate.value) {
				toDate.setErrors({ invalid: true });
                return { [toField]: true };
            }
            if (hasRequiredField(fromDate)) {
                fromDate.setErrors({ required: true });
            } else {
                fromDate.setErrors(null);
            }
            if (hasRequiredField(toDate)) {
                toDate.setErrors({ required: true });
            } else {
                toDate.setErrors(null);
            }
            return null;
        };
    }
}

export const hasRequiredField = (control: AbstractControl): boolean => {
    if (!control) {
        return false;
    }
    if (!control.validator) {
        return false;
    }
    return (control.errors && control.errors.required);
};