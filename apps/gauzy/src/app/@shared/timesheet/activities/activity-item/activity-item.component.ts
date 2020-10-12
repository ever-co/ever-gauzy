import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
import { IDailyActivity } from '@gauzy/models';
@Component({
	selector: 'ngx-activity-item',
	templateUrl: './activity-item.component.html',
	styleUrls: ['./activity-item.component.scss']
})
export class ActivityItemComponent implements OnInit, OnDestroy {
	childOpen: boolean;
	private _item: IDailyActivity;

	@Output() loadChild: EventEmitter<any> = new EventEmitter();
	@Input() allowChild = false;
	@Input()
	public get item(): IDailyActivity {
		return this._item;
	}
	public set item(value: IDailyActivity) {
		value.durationPercentage = parseFloat(
			parseInt(value.durationPercentage + '', 10).toFixed(1)
		);
		this._item = value;
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

	toggleChild() {
		this.childOpen = !this.childOpen;
		if (this.childOpen) {
			this.loadChild.emit(this.item);
		}
	}
	ngOnDestroy(): void {}
}
