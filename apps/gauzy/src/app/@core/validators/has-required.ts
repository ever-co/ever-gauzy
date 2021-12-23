import { AbstractControl } from "@angular/forms";

export const hasRequiredField = (control: AbstractControl): boolean => {
    if (!control) {
        return false;
    }
    if (!control.validator) {
        return false;
    }
    return (control.errors && control.errors.required);
};