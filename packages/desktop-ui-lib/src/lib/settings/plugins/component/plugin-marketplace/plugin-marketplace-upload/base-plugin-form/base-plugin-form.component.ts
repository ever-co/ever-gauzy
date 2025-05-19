import { Directive, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Directive()
export abstract class BasePluginFormComponent {
	@Input() form: FormGroup;

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}
}
