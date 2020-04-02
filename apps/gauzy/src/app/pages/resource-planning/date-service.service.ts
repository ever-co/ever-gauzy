import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class DateService {
	_selectedDate: Date;
	_selectedDate$ = new BehaviorSubject<Date>(this.selectedDate);

	set selectedDate(date: Date) {
		this._selectedDate = date;
		this._selectedDate$.next(date);
	}

	get selectedDate() {
		return this._selectedDate;
	}

	daysInMonth(dateInMonth) {
		return new Date(
			dateInMonth.getFullYear(),
			dateInMonth.getMonth() + 1,
			0
		).getDate();
	}
}
