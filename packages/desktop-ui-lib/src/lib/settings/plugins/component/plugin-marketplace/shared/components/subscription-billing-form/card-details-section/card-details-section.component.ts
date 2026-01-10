import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'gauzy-card-details-section',
	templateUrl: './card-details-section.component.html',
	styleUrls: ['./card-details-section.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class CardDetailsSectionComponent {
	@Input({ required: true }) form!: FormGroup;
	@Input() hasError: (controlName: string, errorName: string) => boolean = () => false;
}
