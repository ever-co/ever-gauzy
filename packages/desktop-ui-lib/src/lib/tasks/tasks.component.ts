import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
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
import { Color, rgbString } from '@kurkle/color';
import * as moment from 'moment';

const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);

@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss'],
})
export class TasksComponent implements OnInit {
	@Input() userData: IUserOrganization;
	@Input() employee: IEmployee;
	@Input() selectedProject: IOrganizationProject;
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
			id: TaskStatusEnum.OPEN,
			name: TaskStatusEnum.OPEN,
		},
		{
			id: TaskStatusEnum.IN_PROGRESS,
			name: TaskStatusEnum.IN_PROGRESS,
		},
		{
			id: TaskStatusEnum.READY_FOR_REVIEW,
			name: TaskStatusEnum.READY_FOR_REVIEW,
		},
		{
			id: TaskStatusEnum.IN_REVIEW,
			name: TaskStatusEnum.IN_REVIEW,
		},
		{
			id: TaskStatusEnum.BLOCKED,
			name: TaskStatusEnum.BLOCKED,
		},
		{
			id: TaskStatusEnum.COMPLETED,
			name: TaskStatusEnum.COMPLETED,
		},
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
			dueDate: new FormControl(
				moment().add(1, 'day').utc().toDate(),
				Validators.required
			),
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
				message: 'Added successfully',
			});
		} catch (error) {
			console.log(error);
			this.newTaskCallback.emit({
				isSuccess: false,
				message: error.message,
			});
		}
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
			this.toastrService.success('Project added successfully', 'Gauzy');
		} catch (error) {
			this.toastrService.danger(error);
		}
	};

	public background(bgColor: string) {
		let color = new Color(bgColor);
		return color.valid ? bgColor : this._test(bgColor);
	}

	public backgroundContrast(bgColor) {
		let color = new Color(bgColor);
		color = color.valid ? color : new Color(this._hex2rgb(bgColor));
		const MIN_THRESHOLD = 128;
		const MAX_THRESHOLD = 186;
		const contrast = color.rgb
			? color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114
			: null;
		if (contrast < MIN_THRESHOLD) {
			return '#ffffff';
		} else if (contrast > MAX_THRESHOLD) {
			return '#000000';
		}
	}

	private _hex2rgb(hex: string) {
		hex = this._test(hex);
		return rgbString({
			r: parseInt(hex.slice(1, 3), 16),
			g: parseInt(hex.slice(3, 5), 16),
			b: parseInt(hex.slice(5, 7), 16),
			a: 1,
		});
	}

	private _test(hex: string): string {
		const regex = /^#[0-9A-F]{6}$/i;
		if (regex.test(hex)) {
			return hex;
		} else {
			hex = '#' + hex;
			return regex.test(hex) ? hex : '#000000';
		}
	}
}
