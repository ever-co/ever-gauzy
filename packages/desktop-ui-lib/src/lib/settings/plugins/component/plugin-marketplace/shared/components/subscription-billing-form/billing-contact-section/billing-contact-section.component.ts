import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbFormFieldModule, NbInputModule } from '@nebular/theme';

@Component({
    selector: 'gauzy-billing-contact-section',
    templateUrl: './billing-contact-section.component.html',
    styleUrls: ['./billing-contact-section.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, FormsModule, ReactiveFormsModule, NbIconModule, NbFormFieldModule, NbInputModule]
})
export class BillingContactSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
