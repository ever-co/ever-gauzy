import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CurrenciesEnum } from '@gauzy/contracts';
import { BillingOption } from '../types';

@Component({
	selector: 'gauzy-billing-cycle-section',
	templateUrl: './billing-cycle-section.component.html',
	styleUrls: ['./billing-cycle-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class BillingCycleSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() billingOptions: BillingOption[] = [];
	@Input() currency?: CurrenciesEnum = CurrenciesEnum.USD;
}
