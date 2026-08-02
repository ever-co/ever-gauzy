import { Component, Input } from '@angular/core';

/**
 * Grid cell renderer for the teams on a record. Accepts either team objects or
 * plain team names, which is what `ngx-assigned-to` hands it.
 */
@Component({
	selector: 'ngx-task-teams',
	templateUrl: './task-teams.component.html',
	styleUrls: ['./task-teams.component.scss'],
	standalone: false
})
export class TaskTeamsComponent {
	@Input() rowData: any;
	@Input() value: any;
}
