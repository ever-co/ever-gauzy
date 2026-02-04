import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaymentMethod } from '../types';
import { NbCardModule, NbIconModule, NbBadgeModule } from '@nebular/theme';

@Component({
    selector: 'gauzy-payment-method-section',
    templateUrl: './payment-method-section.component.html',
    styleUrls: ['./payment-method-section.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, FormsModule, ReactiveFormsModule, NbIconModule, NbBadgeModule]
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
