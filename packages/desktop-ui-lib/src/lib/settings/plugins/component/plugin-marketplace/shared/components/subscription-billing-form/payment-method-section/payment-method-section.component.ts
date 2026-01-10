import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { PaymentMethod } from '../types';

@Component({
	selector: 'gauzy-payment-method-section',
	templateUrl: './payment-method-section.component.html',
	styleUrls: ['./payment-method-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PaymentMethodSectionComponent {
	readonly form = input.required<FormGroup>();
	readonly paymentMethods = input<PaymentMethod[]>([]);

	protected get paymentMethodControl(): FormControl<string | null> | null {
		const control = this.form().get('paymentMethod');
		return control instanceof FormControl ? (control as FormControl<string | null>) : null;
	}

	protected selectPaymentMethod(value: string): void {
		this.paymentMethodControl?.setValue(value);
	}

	protected isSelected(value: string): boolean {
		return this.paymentMethodControl?.value === value;
	}
}
