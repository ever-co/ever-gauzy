import { Component, Input } from '@angular/core';
import * as moment from 'moment';

@Component({
	selector: 'gauzy-task-due-date',
	templateUrl: './task-due-date.component.html',
	styleUrls: ['./task-due-date.component.scss'],
})
export class TaskDueDateComponent {
	constructor() {
		this.format = 'YYYY-MM-DD';
	}

	private _dueDate: string | Date;

	public get dueDate(): string {
		return moment(this._dueDate).format(this._format);
	}

	@Input()
	public set dueDate(value: string) {
		this._dueDate = value;
	}

	private _format: string;

	public get format(): string {
		return this._format;
	}

	@Input()
	public set format(value: string) {
		if (value) {
			this._format = value;
		}
	}
}
