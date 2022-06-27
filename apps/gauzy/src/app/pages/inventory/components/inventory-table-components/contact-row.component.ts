import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';


@Component({
	template: `<div>{{address}}</div> `
})
export class ContactRowComponent implements ViewCell {
	value: any;
	rowData: any;

	get address() {

		if (!this.value) return '-';

		let props = [];

		for (const property in this.value) {
			if (!['country', 'city', 'address'].includes(property)) continue;
			props.push(this.value[property]);
		}

		return props.filter(p => !!p).join(', ');
	}
}