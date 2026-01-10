import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'gauzy-subscription-consent-section',
	templateUrl: './subscription-consent-section.component.html',
	styleUrls: ['./subscription-consent-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class SubscriptionConsentSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
