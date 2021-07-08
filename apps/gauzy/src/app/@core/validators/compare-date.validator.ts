import { AbstractControl, ValidatorFn } from "@angular/forms";

export class CompareDateValidators {
    static validateDate(fromField: string, toField: string): ValidatorFn {
        return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
            const fromDate = formGroup.get(fromField);
            const toDate = formGroup.get(toField);

            if ((fromDate.value !== null && toDate.value !== null) && fromDate.value > toDate.value) {
				toDate.setErrors({ invalid: true });
                return { [toField]: true };
            }

			toDate.setErrors(null);
            return null;
        };
    }
}