import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { TimeSlot } from '@gauzy/models';

@Component({
	selector: 'ngx-activity-item',
	templateUrl: './activity-item.component.html',
	styleUrls: ['./activity-item.component.scss']
})
export class ActivityItemComponent implements OnInit, OnDestroy {
	private _item: TimeSlot;
	@Input()
	public get item(): TimeSlot {
		return this._item;
	}
	public set item(value: TimeSlot) {
		value.durationPercentage = value.durationPercentage.toFixed(1);
		this._item = value;
	}

	constructor() {}

	ngOnInit(): void {}

	prgressStatus(value) {
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

	ngOnDestroy(): void {}
}
