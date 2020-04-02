import { Component, OnInit, Input, Output } from '@angular/core';
import { EventEmitter } from 'events';

@Component({
	selector: 'ngx-day-cell',
	templateUrl: './day-cell.component.html',
	styleUrls: ['../time-calendar.component.scss']
})
export class DayCellComponent implements OnInit {
	@Input() date: any;

	@Input() title: string;

	constructor() {}

	ngOnInit() {}

	get dateNum() {
		return this.date && this.date.getDate();
	}
}
