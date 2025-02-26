import { Component, OnInit, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { IDailyActivity } from '@gauzy/contracts';

@Component({
    selector: 'ngx-activity-item',
    templateUrl: './activity-item.component.html',
    styleUrls: ['./activity-item.component.scss'],
    standalone: false
})
export class ActivityItemComponent implements OnInit, OnDestroy {
	childOpen: boolean = false; // Property to track if the child is open or not
	progressStatus = progressStatus;

	@Output() loadChild: EventEmitter<any> = new EventEmitter<any>(); // Event emitter to notify when child is loaded
	@Input() allowChild = false;
	@Input() isDashboard = false;

	private _item: IDailyActivity;
	public get item(): IDailyActivity {
		return this._item;
	}
	@Input() public set item(value: IDailyActivity) {
		value.durationPercentage = parseFloat(parseInt(value.durationPercentage + '', 10).toFixed(1));
		this._item = value;
	}

	private _visitedDate: string;
	public get visitedDate() {
		return this._visitedDate;
	}
	@Input() public set visitedDate(value: string) {
		this._visitedDate = value;
	}

	ngOnInit(): void {}

	/**
	 * Toggles the child component's visibility.
	 * If the child is opened, emits the loadChild event with the current item.
	 */
	toggleChild(): void {
		this.childOpen = !this.childOpen;
		if (this.childOpen) {
			this.loadChild.emit(this.item);
		}
	}

	ngOnDestroy(): void {}
}
