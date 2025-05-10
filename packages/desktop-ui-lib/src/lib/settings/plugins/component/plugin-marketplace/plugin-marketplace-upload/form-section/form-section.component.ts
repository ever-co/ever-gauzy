import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'lib-form-section',
	templateUrl: './form-section.component.html',
	styleUrls: ['./form-section.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormSectionComponent {
	@Input() title: string;
}
