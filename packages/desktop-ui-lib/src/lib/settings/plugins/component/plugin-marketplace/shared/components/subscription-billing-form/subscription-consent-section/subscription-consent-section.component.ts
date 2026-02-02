import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbCheckboxModule, NbIconModule } from '@nebular/theme';

@Component({
    selector: 'gauzy-subscription-consent-section',
    templateUrl: './subscription-consent-section.component.html',
    styleUrls: ['./subscription-consent-section.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, ReactiveFormsModule, NbCardModule, NbCheckboxModule, NbIconModule]
})
export class SubscriptionConsentSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
