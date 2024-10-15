import { Component, Input } from '@angular/core';
import { FormControl, NgModel } from '@angular/forms';

@Component({
	selector: 'ngx-error-message',
	templateUrl: './error-message.component.html',
	styleUrls: ['./error-message.component.scss']
})
export class ErrorMessageComponent {
	@Input() field: FormControl | NgModel;

	public get message(): string | null {
		const controlErrors = this.getControlErrors();
		if (controlErrors) {
			for (const error in controlErrors) {
				if (this.isTouchedOrDirty()) {
					return this.getErrorMessage(error, controlErrors[error]);
				}
			}
		}
		return null;
	}

	private getControlErrors(): any {
		if (this.field) {
			return this.field.errors;
		} else if (this.field instanceof NgModel) {
			return this.field.errors;
		}
		return null;
	}

	private isTouchedOrDirty(): boolean {
		if (this.field instanceof FormControl) {
			return this.field.touched || this.field.dirty;
		} else if (this.field instanceof NgModel) {
			return this.field.control.touched || this.field.control.dirty;
		}
		return false;
	}

	private getErrorMessage(error: string, errorValue: any): string {
		const errorMessages: { [key: string]: string } = {
			required: 'This field is required',
			minlength: `Minimum length is ${errorValue.requiredLength}`,
			maxlength: `Maximum length is ${errorValue.requiredLength}`,
			email: 'Please enter a valid email address'
		};

		return errorMessages[error] || 'Invalid field';
	}
}
