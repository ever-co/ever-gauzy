import { AbstractControl, ValidatorFn } from "@angular/forms";
import { patterns } from "../../@shared/regex/regex-patterns.const";

export class UrlPatternValidator {
    static urlFieldValidator(field: string): ValidatorFn {
        return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
            const control = formGroup.get(field);
            return UrlPatternValidator.urlAbstractValidator(control);
        };
    }

    static urlAbstractValidator(control: AbstractControl) {
        if (control.value && !UrlPatternValidator.isValidUrl(control.value)) {
            control.setErrors({ invalid: true });
            return { urlValid: false };
        }
        control.setErrors(null);
        return null;
    }

    static isValidUrl(urlString: string): boolean {
        try {
            let pattern = new RegExp(patterns.websiteUrl);
            let valid = pattern.test(urlString);
            return valid;
        } catch (TypeError) {
            return false;
        }
    }
}