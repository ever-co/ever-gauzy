import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { PaymentMethod } from '../types';

@Component({
	selector: 'gauzy-payment-method-section',
	templateUrl: './payment-method-section.component.html',
	styleUrls: ['./payment-method-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PaymentMethodSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() paymentMethods: PaymentMethod[] = [];
}
