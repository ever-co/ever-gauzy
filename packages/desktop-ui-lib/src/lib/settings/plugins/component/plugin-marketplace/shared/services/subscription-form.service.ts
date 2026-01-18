import { Injectable } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PluginBillingPeriod } from '../../../../services/plugin-subscription.service';

/**
 * Service responsible for subscription form creation and validation
 * Following Single Responsibility Principle
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionFormService {
	constructor(private readonly formBuilder: FormBuilder) {}

	/**
	 * Create subscription form with default configuration
	 */
	createSubscriptionForm(): FormGroup {
		return this.formBuilder.group({
			subscriptionType: ['', Validators.required],
			billingPeriod: [PluginBillingPeriod.MONTHLY, Validators.required],
			autoRenew: [true],
			paymentMethod: ['card', Validators.required],
			cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
			expiryDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
			cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
			billingName: ['', Validators.required],
			billingEmail: ['', [Validators.required, Validators.email]],
			acceptTerms: [false, Validators.requiredTrue]
		});
	}

	/**
	 * Update card field validators based on payment method
	 */
	updateCardFieldValidators(form: FormGroup, paymentMethod: string): void {
		const cardNumberControl = form.get('cardNumber');
		const expiryDateControl = form.get('expiryDate');
		const cvvControl = form.get('cvv');

		if (paymentMethod === 'card') {
			this.setCardFieldValidators(cardNumberControl, expiryDateControl, cvvControl);
		} else {
			this.clearCardFieldValidators(cardNumberControl, expiryDateControl, cvvControl);
		}

		this.updateValidityAndClearValues(cardNumberControl, expiryDateControl, cvvControl, paymentMethod);
	}

	/**
	 * Mark all form fields as touched
	 */
	markFormGroupTouched(formGroup: FormGroup): void {
		Object.keys(formGroup.controls).forEach((key) => {
			const control = formGroup.get(key);
			control?.markAsTouched();

			if (control instanceof FormGroup) {
				this.markFormGroupTouched(control);
			}
		});
	}

	/**
	 * Get all form validation errors
	 */
	getFormValidationErrors(formGroup: FormGroup): Record<string, any> {
		const errors: Record<string, any> = {};

		Object.keys(formGroup.controls).forEach((key) => {
			const control = formGroup.get(key);
			if (control && control.errors) {
				errors[key] = control.errors;
			}
		});

		return errors;
	}

	/**
	 * Check if form has specific error
	 */
	hasError(form: FormGroup, controlName: string, errorName: string): boolean {
		const control = form.get(controlName);
		return !!(control && control.hasError(errorName) && control.touched);
	}

	/**
	 * Reset form to initial state
	 */
	resetForm(form: FormGroup): void {
		form.reset({
			subscriptionType: '',
			billingPeriod: PluginBillingPeriod.MONTHLY,
			autoRenew: true,
			paymentMethod: 'card',
			cardNumber: '',
			expiryDate: '',
			cvv: '',
			billingName: '',
			billingEmail: '',
			acceptTerms: false
		});
	}

	/**
	 * Private helper: Set card field validators
	 */
	private setCardFieldValidators(
		cardNumber: AbstractControl | null,
		expiryDate: AbstractControl | null,
		cvv: AbstractControl | null
	): void {
		cardNumber?.setValidators([Validators.required, Validators.pattern(/^\d{16}$/)]);
		expiryDate?.setValidators([Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]);
		cvv?.setValidators([Validators.required, Validators.pattern(/^\d{3,4}$/)]);
	}

	/**
	 * Private helper: Clear card field validators
	 */
	private clearCardFieldValidators(
		cardNumber: AbstractControl | null,
		expiryDate: AbstractControl | null,
		cvv: AbstractControl | null
	): void {
		cardNumber?.clearValidators();
		expiryDate?.clearValidators();
		cvv?.clearValidators();
	}

	/**
	 * Private helper: Update validity and clear values if needed
	 */
	private updateValidityAndClearValues(
		cardNumber: AbstractControl | null,
		expiryDate: AbstractControl | null,
		cvv: AbstractControl | null,
		paymentMethod: string
	): void {
		if (paymentMethod !== 'card') {
			cardNumber?.setValue('');
			expiryDate?.setValue('');
			cvv?.setValue('');
		}

		cardNumber?.updateValueAndValidity();
		expiryDate?.updateValueAndValidity();
		cvv?.updateValueAndValidity();
	}
}
