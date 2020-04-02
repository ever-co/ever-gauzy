import { Component, OnInit, Input, Output, OnDestroy } from '@angular/core';
import { DateService } from '../../date-service.service';
import { takeUntil, take } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
	selector: 'ngx-day-title-cell',
	template: `
		<div class="cell-day-title">
			<div class="day-num">{{ getDate() }}</div>
			<div class="day-title">{{ getDayTitle() }}</div>
		</div>
	`,
	styleUrls: ['../time-calendar.component.scss']
})
export class DayTitleCellComponent implements OnInit, OnDestroy {
	@Input() date: Date;
	selectedDate: Date;
	private _ngDestroy$ = new Subject<void>();

	dayTitles = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday'
	];

	constructor(private dateService: DateService) {}

	ngOnInit() {
		this.dateService._selectedDate$.pipe(take(1)).subscribe((date) => {
			this.selectedDate = date;
		});
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	getDayTitle() {
		const dayIdx = this.date.getDay();
		console.log(dayIdx);
		return this.dayTitles && this.dayTitles[dayIdx];
	}

	getDate() {
		return this.date && this.date.getDate();
	}
}
