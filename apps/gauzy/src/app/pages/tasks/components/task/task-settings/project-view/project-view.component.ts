import { Component, OnInit, Input } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';

export enum ProjectTaskListType {
	Grid = 'grid',
	Sprint = 'sprint'
}

@Component({
	selector: 'ngx-project-view',
	templateUrl: './project-view.component.html',
	styleUrls: ['./project-view.component.scss']
})
export class ProjectViewComponent implements OnInit {
	@Input() project: OrganizationProjects;
	taskListTypes: typeof ProjectTaskListType = ProjectTaskListType;
	projectTaskListType: ProjectTaskListType[] = [
		ProjectTaskListType.Grid,
		ProjectTaskListType.Sprint
	];
	selectedProjectTaskListType: ProjectTaskListType = ProjectTaskListType.Grid;

	constructor() {}

	ngOnInit(): void {}

	setListType(evt: ProjectTaskListType): void {}
}
