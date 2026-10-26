import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'gauzy-email',
    templateUrl: './email.component.html',
    styleUrls: ['./email.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EmailComponent {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	constructor() { }
}
