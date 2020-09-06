import {
	Component,
	OnInit,
	Input,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
import { TimeSlot } from '@gauzy/models';

@Component({
	selector: 'ngx-activity-item',
	templateUrl: './activity-item.component.html',
	styleUrls: ['./activity-item.component.scss']
})
export class ActivityItemComponent implements OnInit, OnDestroy {
	childOpen: boolean;
	childItems: TimeSlot[];
	private _item: TimeSlot;

	@Output() loadChild: EventEmitter<any> = new EventEmitter();
	@Input() allowChild = false;
	@Input()
	public get item(): TimeSlot {
		return this._item;
	}
	public set item(value: TimeSlot) {
		value.durationPercentage = parseInt(
			value.durationPercentage + '',
			10
		).toFixed(1);
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

	toggleChild() {
		this.childOpen = !this.childOpen;
		if (this.childOpen) {
			this.loadChild.emit(this.item);
		}
	}
	ngOnDestroy(): void {}
}
