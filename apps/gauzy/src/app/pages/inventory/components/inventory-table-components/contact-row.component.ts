import { Component, Input } from '@angular/core';

@Component({
    template: `<div>{{address}}</div> `,
    standalone: false
})
export class ContactRowComponent {
	@Input() value: any;
	@Input() rowData: any;

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
