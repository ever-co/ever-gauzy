import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbCardModule, NbIconModule, NbFormFieldModule, NbInputModule, NbTooltipModule } from '@nebular/theme';

@Component({
    selector: 'gauzy-card-details-section',
    templateUrl: './card-details-section.component.html',
    styleUrls: ['./card-details-section.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbCardModule, FormsModule, ReactiveFormsModule, NbIconModule, NbFormFieldModule, NbInputModule, NbTooltipModule]
})
export class CardDetailsSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
