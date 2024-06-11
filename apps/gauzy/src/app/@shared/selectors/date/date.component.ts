import { Component, OnInit, ViewChild } from '@angular/core';
import { NbCalendarMonthPickerComponent } from '@nebular/theme';
import { min, addYears, subYears } from 'date-fns';
import { monthNames } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ga-date-selector',
	templateUrl: './date.component.html',
	styleUrls: ['./date.component.scss'],
	host: {
		'(document:click)': 'clickOutside($event)'
	}
})
export class DateSelectorComponent implements OnInit {
	loadCalendar = false;
	dateInputValue: string;
	date = new Date();
	max;
	min;
	@ViewChild('month')
	monthRef: NbCalendarMonthPickerComponent<any, any>;

	constructor(private store: Store) {}

	ngOnInit() {
		this.dateInputValue = this.formatDateMMMMyy(this.date);
	}

	handleDateChange(chosenDate: Date) {
		/**
		 * Selecting a month from previous year which is unavailable for current year
		 * and then selecting current year, makes the unavailable month selected for current year
		 * Ensure that chosenDate does not exceed the max limit
		 */
		chosenDate = min([chosenDate, this.max]);

		this.date = chosenDate;

		/**
		 * nb-calendar-month-picker component does not get updated when the year is changed
		 * manually refresh the month picker component
		 */
		this.monthRef.month = chosenDate;
		this.monthRef.initMonths();

		this.dateInputValue = this.formatDateMMMMyy(this.date);
	}

	formatDateMMMMyy(date): string {
		const monthIndex = date.getMonth();
		const year = date.getFullYear();

		return monthNames[monthIndex] + ', ' + year;
	}

	handleCalendarOpen() {
		const currentDate = new Date();
		/**
		 * If the selected Organization has chosen to allow future period selection,
		 * set max to 10 years after current Date, otherwise max allowed date is current Date
		 */
		this.max =
			this.store.selectedOrganization && this.store.selectedOrganization.futureDateAllowed
				? addYears(currentDate.setMonth(11), 10)
				: currentDate;

		this.min =
			this.store.selectedOrganization && this.store.selectedOrganization.registrationDate
				? new Date(this.store.selectedOrganization.registrationDate)
				: subYears(new Date().setMonth(11), 15);

		this.loadCalendar = true;
	}

	clear() {
		this.dateInputValue = '';
		this.date = new Date();
	}

	clickOutside(event) {
		if (!document.getElementById('dashboard-calendar').contains(event.target)) {
			this.loadCalendar = false;
		}
	}
}
