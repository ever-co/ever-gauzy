import { Component, OnInit, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
import { progressStatus } from '@gauzy/ui-sdk/common';
import { IDailyActivity } from '@gauzy/contracts';

@Component({
	selector: 'ngx-activity-item',
	templateUrl: './activity-item.component.html',
	styleUrls: ['./activity-item.component.scss']
})
export class ActivityItemComponent implements OnInit, OnDestroy {
	childOpen: boolean;
	private _item: IDailyActivity;
	private _visitedDate: string;

	@Output() loadChild: EventEmitter<any> = new EventEmitter();
	@Input() allowChild = false;
	@Input() isDashboard = false;

	public get item(): IDailyActivity {
		return this._item;
	}
	@Input() public set item(value: IDailyActivity) {
		value.durationPercentage = parseFloat(parseInt(value.durationPercentage + '', 10).toFixed(1));
		this._item = value;
	}

	public get visitedDate() {
		return this._visitedDate;
	}
	@Input() public set visitedDate(value: string) {
		this._visitedDate = value;
	}

	progressStatus = progressStatus;

	constructor() {}

	ngOnInit(): void {}

	toggleChild() {
		this.childOpen = !this.childOpen;
		if (this.childOpen) {
			this.loadChild.emit(this.item);
		}
	}

	ngOnDestroy(): void {}
}
