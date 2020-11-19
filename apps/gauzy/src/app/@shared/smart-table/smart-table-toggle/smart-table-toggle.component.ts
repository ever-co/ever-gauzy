import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-smart-table-toggle',
	templateUrl: './smart-table-toggle.component.html',
	styleUrls: ['./smart-table-toggle.component.scss']
})
export class SmartTableToggleComponent implements OnInit {
	checked: boolean;

	@Input() set value(object) {
		for (const key in object) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				this[key] = object[key];
			}
		}
	}

	onChange = (_isChecked: boolean) => {};

	constructor() {}

	ngOnInit() {}

	onCheckedChange(isChecked) {
		this.onChange(isChecked);
	}
}
