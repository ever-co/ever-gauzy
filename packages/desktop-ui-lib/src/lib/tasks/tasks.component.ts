import { Component, Input, OnInit, Output, EventEmitter, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import {
	IEmployee,
	IOrganizationProject,
	ITag,
	IUserOrganization,
	TaskStatusEnum,
} from '@gauzy/contracts';
import { NbToastrService } from '@nebular/theme';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { ColorAdapter } from '../utils';
import { GAUZY_ENV } from '../constants';

@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss'],
})
export class TasksComponent implements OnInit {
	@Input() userData: IUserOrganization;
	@Input() employee: IEmployee;
	@Input() hasProjectPermission: boolean;
	@Input() selectedProject: IOrganizationProject;
	@Output() isAddTask: EventEmitter<boolean> = new EventEmitter();
	@Output() newTaskCallback: EventEmitter<{
		isSuccess: boolean;
		message: string;
	}> = new EventEmitter();
	public isSaving: boolean;

	form: FormGroup;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	tags: ITag[] = [];
	statuses = [
		{
			id: TaskStatusEnum.OPEN,
			name: this._formatStatus(TaskStatusEnum.OPEN),
		},
		{
			id: TaskStatusEnum.IN_PROGRESS,
			name: this._formatStatus(TaskStatusEnum.IN_PROGRESS),
		},
		{
			id: TaskStatusEnum.READY_FOR_REVIEW,
			name: this._formatStatus(TaskStatusEnum.READY_FOR_REVIEW),
		},
		{
			id: TaskStatusEnum.IN_REVIEW,
			name: this._formatStatus(TaskStatusEnum.IN_REVIEW),
		},
		{
			id: TaskStatusEnum.BLOCKED,
			name: this._formatStatus(TaskStatusEnum.BLOCKED),
		},
		{
			id: TaskStatusEnum.COMPLETED,
			name: this._formatStatus(TaskStatusEnum.COMPLETED),
		},
	];

	constructor(
		private timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService,
		private translate: TranslateService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
	) {
		this.isSaving = false;
	}

	ngOnInit() {
		(async () => {
			await this._projects(this.userData);
			await this._tags(this.userData);
			await this._employees(this.userData);
		})();
		this.form = new FormGroup({
			description: new FormControl(null),
			dueDate: new FormControl(moment().add(1, 'day').utc().toDate()),
			estimate: new FormControl(null),
			estimateDays: new FormControl(null, [Validators.min(0)]),
			estimateHours: new FormControl(null, [
				Validators.min(0),
				Validators.max(23),
			]),
			estimateMinutes: new FormControl(null, [
				Validators.min(0),
				Validators.max(59),
			]),
			members: new FormControl([]),
			organizationId: new FormControl(this.userData.organizationId),
			project: new FormControl(this.selectedProject),
			projectId: new FormControl(null),
			status: new FormControl(TaskStatusEnum.OPEN),
			tags: new FormControl([]),
			teams: new FormControl([]),
			tenantId: new FormControl(this.userData.tenantId),
			title: new FormControl(null, Validators.required),
		});
	}

	private async _projects(user: IUserOrganization): Promise<void> {
		try {
			this.projects = await this.timeTrackerService.getProjects({
				organizationContactId: null,
				...user,
			});
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
		this.isSaving = true;
		const { estimateDays, estimateHours, estimateMinutes, project } =
			this.form.value;
		const days = estimateDays ? estimateDays * 24 * 3600 : 0;
		const hours = estimateHours ? estimateHours * 3600 : 1;
		const minutes = estimateMinutes ? estimateMinutes * 60 : 0;

		try {
			this.form.patchValue({
				members: [...this.employees],
				estimate: days + hours + minutes,
				projectId: project ? project.id : null,
			});

			await this.timeTrackerService.saveNewTask(
				this.userData,
				this.form.value
			);
			this.isAddTask.emit(false);
			this.newTaskCallback.emit({
				isSuccess: true,
				message: this.translate.instant('TOASTR.MESSAGE.CREATED'),
			});
		} catch (error) {
			console.log(error);
			this.newTaskCallback.emit({
				isSuccess: false,
				message: error.message,
			});
		}

		this.isSaving = false;
	}

	public addProject = async (name: string) => {
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
					: {}),
			};

			request['members'] = [...this.employees];

			const project = await this.timeTrackerService.createNewProject(
				request,
				data
			);

			this.projects = this.projects.concat([project]);
			this.toastrService.success(
				this.translate.instant('TIMER_TRACKER.TOASTR.PROJECT_ADDED'),
				this._environment.DESCRIPTION,
			);
		} catch (error) {
			this.toastrService.danger(error);
		}
	};

	public background(bgColor: string) {
		return ColorAdapter.background(bgColor);
	}

	public backgroundContrast(bgColor: string) {
		return ColorAdapter.contrast(bgColor);
	}

	private _formatStatus(name: string): string {
		return name
			.split('-')
			.join(' ')
			.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
	}
}
