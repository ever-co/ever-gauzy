import { Component, OnInit, Input } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';

export enum TaskViewModeType {
	Grid = 'grid',
	Sprint = 'sprint'
}

export interface TaskViewMode {
	type: TaskViewModeType;
	name: TaskViewModeType;
}

@Component({
	selector: 'ngx-project-view',
	templateUrl: './project-view.component.html',
	styleUrls: ['./project-view.component.scss']
})
export class ProjectViewComponent implements OnInit {
	@Input() project: OrganizationProjects;
	taskViewModeType: typeof TaskViewModeType = TaskViewModeType;
	taskViewModeList: TaskViewMode[] = [
		{ type: TaskViewModeType.Grid, name: TaskViewModeType.Grid },
		{ type: TaskViewModeType.Sprint, name: TaskViewModeType.Sprint }
	];
	selectedTaskViewMode: TaskViewMode = this.taskViewModeList[0];

	constructor() {}

	ngOnInit(): void {}

	setTaskViewMode(evt: TaskViewMode): void {
		this.selectedTaskViewMode = evt;
	}
}
