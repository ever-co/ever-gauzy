import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-task-teams',
    templateUrl: './task-teams.component.html',
    standalone: false
})
export class TaskTeamsComponent {
	@Input()
	rowData: any;
	@Input()
	value: any;

	constructor() { }
}
