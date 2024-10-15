import { ValidatorFn, Validators } from '@angular/forms';
import { SelectorService } from '../../+state/selector.service';
import { NoteService } from '../../features/note/+state/note.service';
import { IValidation } from '../../interfaces/validation.interface';

export class DynamicSelectorValidation implements IValidation {
	constructor(
		private service: any, // Make service type explicit
		private requireField: boolean
	) {}

	public validate(): boolean {
		// Reset errors
		this.clearError();

		// Validate based on service-specific logic
		if (this.isServiceInvalid()) {
			this.setError();
			return false;
		}

		return true;
	}

	// Check if service-specific validation fails
	private isServiceInvalid(): boolean {
		if (this.service instanceof SelectorService) {
			return !this.service.selected && this.requireField;
		}

		if (this.service instanceof NoteService) {
			return !this.service.note && this.requireField;
		}

		return false;
	}

	// Set error on both the form control and service
	public setError(error: any = { required: true }): void {
		const serviceErrorHandler = this.getServiceErrorHandler();
		serviceErrorHandler?.setError(error);
	}

	// Clear any previous errors on the service
	private clearError(): void {
		this.setError(null);
	}

	// Retrieve the appropriate error handler for the service
	private getServiceErrorHandler(): any {
		if (this.service instanceof SelectorService) {
			return this.service.selectorStore;
		}
		return this.service;
	}

	public static requiredValidator(requireField: boolean): ValidatorFn {
		return requireField ? Validators.required : Validators.nullValidator;
	}
}
