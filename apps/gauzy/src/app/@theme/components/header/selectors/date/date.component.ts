import { Component, OnInit, Input, ViewChild } from '@angular/core';
import {
	NbCalendarMonthCellComponent,
	NbCalendarMonthPickerComponent,
	NbCalendarYearPickerComponent
} from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { monthNames } from '../../../../../@core/utils/date';

@Component({
	selector: 'ga-date-selector',
	templateUrl: './date.component.html',
	styleUrls: ['./date.component.scss'],
	host: {
		'(document:click)': 'clickOutside($event)'
	}
})
export class DateSelectorComponent implements OnInit {
	monthCellComponent = NbCalendarMonthCellComponent;
	loadCalendar = false;
	dateInputValue: string;
	date = new Date();
	max = new Date();
	@ViewChild('month', { static: false })
	monthRef: NbCalendarMonthPickerComponent<any, any>;

	constructor(private store: Store) {}

	ngOnInit() {
		this.store.selectedDate = this.date;
		this.dateInputValue = this.formatDateMMMMyy(this.date);
	}

	handleDateChange(event: Date) {
		this.store.selectedDate = event;
		this.date = event;

		// Refresh Months when Year is changed
		this.monthRef.month = event;
		this.monthRef.initMonths();

		this.dateInputValue = this.formatDateMMMMyy(this.date);
	}

	formatDateMMMMyy(date): string {
		const monthIndex = date.getMonth();
		const year = date.getFullYear();

		return monthNames[monthIndex] + ', ' + year;
	}

	clear() {
		this.dateInputValue = '';
		this.date = new Date();
		this.store.selectedDate = null;
	}

	clickOutside(event) {
		if (
			!document
				.getElementById('dashboard-calendar')
				.contains(event.target)
		) {
			this.loadCalendar = false;
		}
	}
}
