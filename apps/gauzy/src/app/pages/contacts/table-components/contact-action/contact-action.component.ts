import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ComponentLayoutStyleEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-contact-action',
	templateUrl: './contact-action.component.html'
})
export class ContactActionComponent implements ViewCell {
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
