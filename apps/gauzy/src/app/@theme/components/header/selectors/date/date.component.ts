import { Component, OnInit } from '@angular/core';
import { NbCalendarMonthCellComponent } from '@nebular/theme';

@Component({
    selector: 'ea-date-selector',
    templateUrl: './date.component.html',
    styleUrls: ['./date.component.scss'],
    host: {
        '(document:click)': 'clickOutside($event)'
    }
})
export class DateSelectorComponent implements OnInit {
    uselessCancer: string[];
    monthCellComponent = NbCalendarMonthCellComponent;
    loadCalendar = false;
    date = new Date();
    min = new Date(this.date.getFullYear() - 9, 6, 15);
    max = new Date();

    ngOnInit(): void {
        //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
        //Add 'implements OnInit' to the class.
        this.date.setMonth(this.date.getMonth() - 1);
    }

    handleMonthChange(event) {
        this.loadCalendar = false;
    }

    formatDateMMMMyy(date) {
        const monthNames = [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
        ];

        const monthIndex = date.getMonth();
        const year = date.getFullYear();

        return monthNames[monthIndex] + ', ' + year;
    }

    getDefaultDate() {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date;
    }

    clickOutside(event) {
        if (!document.getElementById('dashboard-calendar').contains(event.target)) {
            this.loadCalendar = false;
        }
    }
}