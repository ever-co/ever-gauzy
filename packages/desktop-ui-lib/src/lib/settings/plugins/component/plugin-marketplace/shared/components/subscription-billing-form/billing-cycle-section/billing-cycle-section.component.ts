import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CurrenciesEnum } from '@gauzy/contracts';
import { BillingOption } from '../types';
import { NbCardModule, NbIconModule, NbRadioModule, NbBadgeModule } from '@nebular/theme';
import { CurrencyPipe } from '@angular/common';

@Component({
    selector: 'gauzy-billing-cycle-section',
    templateUrl: './billing-cycle-section.component.html',
    styleUrls: ['./billing-cycle-section.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, FormsModule, ReactiveFormsModule, NbIconModule, NbRadioModule, NbBadgeModule, CurrencyPipe]
})
export class BillingCycleSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() billingOptions: BillingOption[] = [];
	@Input() currency?: CurrenciesEnum = CurrenciesEnum.USD;
}
