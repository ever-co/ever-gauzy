import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';

@Component({
    selector: 'ngx-contact-action',
    templateUrl: './contact-action.component.html',
    styleUrls: ['../../contacts.component.scss'],
    standalone: false
})
export class ContactActionComponent {
	@Input()
	rowData: any;

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	@Input()
	value: string | number;

	@Output() updateResult = new EventEmitter<any>();

	invite(data) {
		this.updateResult.emit(data);
	}
}
