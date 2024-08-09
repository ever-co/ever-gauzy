import { Component, Input } from '@angular/core';

@Component({
	selector: 'gauzy-email',
	templateUrl: './email.component.html',
	styleUrls: ['./email.component.scss']
})
export class EmailComponent {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	constructor() { }
}
