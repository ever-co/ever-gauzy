import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-progress-status',
	templateUrl: './progress-status.component.html',
	styleUrls: ['./progress-status.component.scss']
})
export class ProgressStatusComponent implements OnInit {
	private _percentage;
	@Input()
	public get percentage() {
		return this._percentage;
	}
	public set percentage(value) {
		this._percentage = parseInt(value, 10) || 0;
	}

	constructor() {}

	ngOnInit(): void {}

	progressStatus(value) {
		if (value <= 25) {
			return 'danger';
		} else if (value <= 50) {
			return 'warning';
		} else if (value <= 75) {
			return 'info';
		} else {
			return 'success';
		}
	}
}
