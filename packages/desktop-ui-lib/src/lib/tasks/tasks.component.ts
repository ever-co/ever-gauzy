import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import {
	IEmployee,
	IOrganizationProject,
	ITag,
	IUserOrganization,
	TaskStatusEnum
} from '@gauzy/contracts';
import { NbToastrService } from '@nebular/theme';
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit {
	@Input() userData: IUserOrganization;
	@Input() employee: IEmployee;

	@Output() isAddTask: EventEmitter<boolean> = new EventEmitter();
	@Output() newTaskCallback: EventEmitter<{
		isSuccess: boolean;
		message: string;
	}> = new EventEmitter();

	form: FormGroup;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	tags: ITag[] = [];
	statuses = [
		{
			id: 'TODO',
			name: TaskStatusEnum.TODO
		},
		{
			id: 'In Progress',
			name: TaskStatusEnum.IN_PROGRESS
		},
		{
			id: 'For Testing',
			name: TaskStatusEnum.FOR_TESTING
		},
		{
			id: 'Completed',
			name: TaskStatusEnum.COMPLETED
		}
	];

	constructor(
		private timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService
	) {}

	ngOnInit() {
		(async () => {
			await this._projects(this.userData);
			await this._tags(this.userData);
			await this._employees(this.userData);
		})();
		this.form = new FormGroup({
			description: new FormControl(null),
			dueDate: new FormControl(null, Validators.required),
			estimate: new FormControl(null),
			estimateDays: new FormControl(null, [Validators.min(0)]),
			estimateHours: new FormControl(null, [
				Validators.min(0),
				Validators.max(23)
			]),
			estimateMinutes: new FormControl(null, [
				Validators.min(0),
				Validators.max(59)
			]),
			members: new FormControl([]),
			organizationId: new FormControl(this.userData.organizationId),
			project: new FormControl(null),
			projectId: new FormControl(null),
			status: new FormControl(this.statuses[0].id),
			tags: new FormControl([]),
			teams: new FormControl([]),
			tenantId: new FormControl(this.userData.tenantId),
			title: new FormControl(null, Validators.required)
		});
	}

	private async _projects(user: IUserOrganization): Promise<void> {
		try {
			this.projects = await this.timeTrackerService.getProjects(user);
		} catch (error) {
			console.error(
				'[error]',
				"can't get employee project::" + error.message
			);
		}
	}

	private async _tags(user: IUserOrganization): Promise<void> {
		try {
			const tagsRes = await this.timeTrackerService.getTags(user);
			this.tags = tagsRes.items;
		} catch (error) {
			console.error('[error]', 'while get tags::' + error.message);
		}
	}

	private async _employees(user: IUserOrganization): Promise<void> {
		try {
			const employee = await this.timeTrackerService.getEmployees(user);
			this.employees = [employee];
		} catch (error) {
			console.error('[error]', 'while get employees::' + error.message);
		}
	}

	public close(): void {
		this.isAddTask.emit(false);
	}

	public async save(): Promise<void> {
		if (this.form.invalid) return;
		const { estimateDays, estimateHours, estimateMinutes, tags, project } =
			this.form.value;
		const days = estimateDays ? estimateDays * 24 * 3600 : 0;
		const hours = estimateHours ? estimateHours * 3600 : 1;
		const minutes = estimateMinutes ? estimateMinutes * 60 : 0;
		const selectedTags = tags.map(
			(i: string) => this.tags.find((y) => y.id === i) || []
		);

		try {
			this.form.patchValue({
				members: [...this.employees],
				estimate: days + hours + minutes,
				tags: selectedTags,
				projectId: project ? project.id : null
			});

			await this.timeTrackerService.saveNewTask(
				this.userData,
				this.form.value
			);
			this.isAddTask.emit(false);
			this.newTaskCallback.emit({
				isSuccess: true,
				message: 'Added successfully'
			});
		} catch (error) {
			console.log(error);
			this.newTaskCallback.emit({
				isSuccess: false,
				message: error.message
			});
		}
	}

	addProject = async (name: string) => {
		try {
			const data = this.userData as any;
			const { tenantId, organizationContactId } = data;
			const { organizationId } = data;

			const request = {
				name,
				organizationId,
				tenantId,
				...(organizationContactId
					? { contactId: organizationContactId }
					: {})
			};

			request['members'] = [...this.employees];

			const project = await this.timeTrackerService.createNewProject(
				request,
				data
			);

			this.projects = this.projects.concat([project]);

			this.toastrService.success('Project added successfully');
		} catch (error) {
			this.toastrService.danger(error);
		}
	};
}
