import { Component, Input } from '@angular/core';
import { ViewCell } from 'angular2-smart-table';

@Component({
	selector: 'ngx-task-teams',
	templateUrl: './task-teams.component.html'
})
export class TaskTeamsComponent implements ViewCell {
	@Input()
	rowData: any;
	@Input()
	value: any;

	constructor() { }
}
