import { Component, Input } from '@angular/core';

@Component({
    selector: 'gauzy-external-link',
    templateUrl: './external-link.component.html',
    styleUrls: ['./external-link.component.scss'],
    standalone: false
})
export class ExternalLinkComponent {
	@Input()
	value: string;

	@Input()
	rowData: any;

	constructor() { }
}
