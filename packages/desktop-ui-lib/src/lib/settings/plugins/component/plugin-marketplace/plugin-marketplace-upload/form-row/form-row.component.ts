import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'lib-form-row',
	templateUrl: './form-row.component.html',
	styleUrls: ['./form-row.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormRowComponent {}
