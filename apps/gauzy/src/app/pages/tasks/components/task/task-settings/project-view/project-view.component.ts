import { Component, OnInit, Input } from '@angular/core';
import { OrganizationProjects, TaskListTypeEnum } from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';

export interface TaskViewMode {
	type: TaskListTypeEnum;
	name: TaskListTypeEnum;
}

@Component({
	selector: 'ngx-project-view',
	templateUrl: './project-view.component.html',
	styleUrls: ['./project-view.component.scss']
})
export class ProjectViewComponent implements OnInit {
	@Input() project: OrganizationProjects;
	taskViewModeType: typeof TaskListTypeEnum = TaskListTypeEnum;
	taskViewModeList: TaskViewMode[] = [
		{ type: TaskListTypeEnum.GRID, name: TaskListTypeEnum.GRID },
		{ type: TaskListTypeEnum.SPRINT, name: TaskListTypeEnum.SPRINT }
	];
	selectedTaskViewMode: TaskViewMode;

	constructor(private projectService: OrganizationProjectsService) {}

	ngOnInit(): void {
		this.selectedTaskViewMode = {
			type: this.project.taskListType as TaskListTypeEnum,
			name: this.project.taskListType as TaskListTypeEnum
		};
	}

	async setTaskViewMode(evt: TaskViewMode): Promise<void> {
		await this.projectService.updateTaskViewMode(this.project.id, evt.type);
	}
}
