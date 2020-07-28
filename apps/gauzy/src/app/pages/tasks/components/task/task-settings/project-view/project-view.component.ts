import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { OrganizationProjects, TaskListTypeEnum } from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

export interface TaskViewMode {
	type: TaskListTypeEnum;
	name: TaskListTypeEnum;
	icon?: string;
}

@Component({
	selector: 'ngx-project-view',
	templateUrl: './project-view.component.html',
	styleUrls: ['./project-view.component.scss']
})
export class ProjectViewComponent implements OnInit {
	@Input() project: OrganizationProjects;
	@Output() changeEvent: EventEmitter<
		Partial<OrganizationProjects>
	> = new EventEmitter();
	taskViewModeType: typeof TaskListTypeEnum = TaskListTypeEnum;
	taskViewModeList: TaskViewMode[] = [
		{
			type: TaskListTypeEnum.GRID,
			name: TaskListTypeEnum.GRID,
			icon: 'grid-outline'
		},
		{
			type: TaskListTypeEnum.SPRINT,
			name: TaskListTypeEnum.SPRINT,
			icon: 'refresh-outline'
		}
	];
	selectedTaskViewMode: TaskViewMode;

	constructor(
		private projectStore: Store,
		private projectService: OrganizationProjectsService
	) {}

	ngOnInit(): void {
		this.selectedTaskViewMode = {
			type: this.project.taskListType as TaskListTypeEnum,
			name: this.project.taskListType as TaskListTypeEnum
		};
	}

	async setTaskViewMode(evt: TaskViewMode): Promise<void> {
		await this.projectService.updateTaskViewMode(this.project.id, evt.type);
		this.projectStore.selectedProject = {
			...this.project,
			taskListType: evt.type
		};
		this.changeEvent.emit({ taskListType: evt.type });
	}
}
