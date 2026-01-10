import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'gauzy-billing-contact-section',
	templateUrl: './billing-contact-section.component.html',
	styleUrls: ['./billing-contact-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class BillingContactSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
