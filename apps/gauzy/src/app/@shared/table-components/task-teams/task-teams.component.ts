import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-task-teams',
	templateUrl: './task-teams.component.html'
})
export class TaskTeamsComponent implements ViewCell {
	@Input()
	rowData: any;

	value: any;

	constructor() {}
}
