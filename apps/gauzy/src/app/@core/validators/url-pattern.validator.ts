import { AbstractControl, ValidatorFn } from "@angular/forms";
import { patterns } from "../../@shared/regex/regex-patterns.const";

export class UrlPatternValidator {
    static websiteUrlValidator(field: string): ValidatorFn {
        return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
            const control = formGroup.get(field);
            return UrlPatternValidator.urlAbstractValidator(control, patterns.websiteUrl);
        };
    }

    static imageUrlValidator(field: string): ValidatorFn {
        return (formGroup: AbstractControl): { [key: string]: boolean } | null => {
            const control = formGroup.get(field);
            return UrlPatternValidator.urlAbstractValidator(control, patterns.imageUrl);
        };
    }

    static urlAbstractValidator(control: AbstractControl, pattern: RegExp) {
        if (control.value && !UrlPatternValidator.isValidUrl(control.value, pattern)) {
            control.setErrors({ invalid: true });
            return { urlValid: false };
        }
        control.setErrors(null);
        return null;
    }

    static isValidUrl(urlString: string, regExp: RegExp): boolean {
        try {
            return new RegExp(regExp).test(urlString);
        } catch (TypeError) {
            return false;
        }
    }
}