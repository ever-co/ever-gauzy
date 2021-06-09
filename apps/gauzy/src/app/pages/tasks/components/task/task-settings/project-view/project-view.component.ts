import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { CrudActionEnum, IOrganizationProject, TaskListTypeEnum } from '@gauzy/contracts';
import { OrganizationProjectsService, OrganizationProjectStore, Store } from '../../../../../../@core/services';

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
	@Input() project: IOrganizationProject;
	@Output() changeEvent: EventEmitter<
		Partial<IOrganizationProject>
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
		private readonly store: Store,
		private readonly projectService: OrganizationProjectsService,
		private readonly organizationProjectStore: OrganizationProjectStore
	) {}

	ngOnInit(): void {
		this.selectedTaskViewMode = {
			type: this.project.taskListType as TaskListTypeEnum,
			name: this.project.taskListType as TaskListTypeEnum
		};
	}

	async setTaskViewMode(evt: TaskViewMode): Promise<void> {
		const project = await this.projectService.updateTaskViewMode(this.project.id, evt.type);
		this.store.selectedProject = {
			...this.project,
			taskListType: evt.type
		};
		this.organizationProjectStore.organizationProjectAction = {
			project,
			action: CrudActionEnum.UPDATED
		};
		this.changeEvent.emit({ taskListType: evt.type });
	}
}
