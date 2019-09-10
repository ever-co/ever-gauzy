import { Component, OnInit } from '@angular/core';
import { NbCalendarMonthCellComponent } from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { monthNames } from '../../../../../@core/utils/date'

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
    dateInputValue: any;
    date = new Date();
    min = new Date(this.date.getFullYear() - 9, 6, 15);
    max = new Date();

    constructor(private store: Store) { }

    ngOnInit() {
        this.date.setMonth(this.date.getMonth());
        this.store.selectedDate = this.date;
        this.dateInputValue = this.formatDateMMMMyy(this.date);
    }

    handleDateChange(event) {
        this.store.selectedDate = event;
        this.date = event;
        this.dateInputValue = this.formatDateMMMMyy(this.date);
    }

    formatDateMMMMyy(date) {
        const monthIndex = date.getMonth();
        const year = date.getFullYear();

        return monthNames[monthIndex] + ', ' + year;
    }

    getDefaultDate() {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date;
    }

    clear() {
        this.dateInputValue = '';
        this.date = this.getDefaultDate();
        this.store.selectedDate = null;
    }

    clickOutside(event) {
        if (!document.getElementById('dashboard-calendar').contains(event.target)) {
            this.loadCalendar = false;
        }
    }
}