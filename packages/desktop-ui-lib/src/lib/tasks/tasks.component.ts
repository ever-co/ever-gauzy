import { Component, EventEmitter, Input, OnInit, Output, Inject } from '@angular/core';
import { FormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import {
	IEmployee,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationTeam,
	ITag,
	ITagCreateInput,
	ITaskPriority,
	ITaskSize,
	ITaskStatus,
	IUserOrganization,
	PermissionsEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { CkEditorConfig, ColorAdapter } from '../utils';
import { Store, TagService } from '../services';
import { GAUZY_ENV } from '../constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap, from, Observable, map } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit {
	@Input() userData: IUserOrganization;
	@Input() employee: IEmployee;
	@Input() hasProjectPermission: boolean;
	@Input() selected: {
		projectId: IOrganizationProject['id'];
		teamId: IOrganizationTeam['id'];
		contactId: IOrganizationContact['id'];
	};
	@Output() isAddTask: EventEmitter<boolean> = new EventEmitter();
	@Output() newTaskCallback: EventEmitter<{
		isSuccess: boolean;
		message: string;
	}> = new EventEmitter();
	public isSaving: boolean;
	public editorConfig = CkEditorConfig.minimal();
	public hasAddTagPermission$: Observable<boolean>;

	form: UntypedFormGroup;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	tags: ITag[] = [];
	taskSizes: ITaskSize[] = [];
	taskStatuses: ITaskStatus[] = [];
	taskPriorities: ITaskPriority[] = [];
	contacts: IOrganizationContact[] = [];
	teams: IOrganizationTeam[] = [];
	statuses = [
		{
			id: TaskStatusEnum.OPEN,
			name: this._formatStatus(TaskStatusEnum.OPEN)
		},
		{
			id: TaskStatusEnum.IN_PROGRESS,
			name: this._formatStatus(TaskStatusEnum.IN_PROGRESS)
		},
		{
			id: TaskStatusEnum.READY_FOR_REVIEW,
			name: this._formatStatus(TaskStatusEnum.READY_FOR_REVIEW)
		},
		{
			id: TaskStatusEnum.IN_REVIEW,
			name: this._formatStatus(TaskStatusEnum.IN_REVIEW)
		},
		{
			id: TaskStatusEnum.BLOCKED,
			name: this._formatStatus(TaskStatusEnum.BLOCKED)
		},
		{
			id: TaskStatusEnum.COMPLETED,
			name: this._formatStatus(TaskStatusEnum.COMPLETED)
		}
	];
	public isLoading = false;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private toastrService: NbToastrService,
		private translate: TranslateService,
		@Inject(GAUZY_ENV)
		private readonly _environment: any,
		private store: Store,
		private _dialogRef: NbDialogRef<TasksComponent>,
		private _tagService: TagService
	) {
		this.isSaving = false;
	}

	private async _projects(user: IUserOrganization): Promise<void> {
		try {
			this.projects = await this.timeTrackerService.getProjects({
				organizationContactId: this.selected.contactId,
				organizationTeamId: this.selected.teamId,
				...user
			});
		} catch (error) {
			console.error('[error]', "can't get employee project::" + error.message);
		}
	}

	private async _tags(): Promise<void> {
		try {
			this.tags = await this._tagService.getTags();
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

	private async _clients(user: IUserOrganization): Promise<void> {
		try {
			this.contacts = await this.timeTrackerService.getClient(user);
		} catch (error) {
			console.error('[error]', 'while get contacts::' + error.message);
		}
	}

	private async _teams(): Promise<void> {
		try {
			this.teams = await this.timeTrackerService.getTeams();
		} catch (error) {
			console.error('[error]', 'while get teams::' + error.message);
		}
	}

	private async _sizes(): Promise<void> {
		try {
			this.taskSizes = await this.timeTrackerService.taskSizes();
		} catch (error) {
			console.error('[error]', 'while get sizes::' + error.message);
		}
	}

	private async _priorities(): Promise<void> {
		try {
			this.taskPriorities = await this.timeTrackerService.taskPriorities();
		} catch (error) {
			console.error('[error]', 'while get priorities::' + error.message);
		}
	}

	private _formatStatus(name: string): string {
		return name
			.split('-')
			.join(' ')
			.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
	}

	ngOnInit() {
		this.editorConfig.editorplaceholder = this.translate.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		this.taskStatuses = this.store.statuses;
		from(
			Promise.allSettled([
				this._projects(this.userData),
				this._tags(),
				this._employees(this.userData),
				this._clients(this.userData),
				this._teams(),
				this._sizes(),
				this._priorities()
			])
		)
			.pipe(
				tap(() => this.form.patchValue({ taskStatus: this.taskStatuses[0] })),
				untilDestroyed(this)
			)
			.subscribe();

		this.form = new UntypedFormGroup({
			description: new FormControl(null),
			dueDate: new FormControl(moment().add(1, 'day').utc().toDate()),
			estimate: new FormControl(null),
			estimateDays: new FormControl(null, [Validators.min(0)]),
			estimateHours: new FormControl(null, [Validators.min(0), Validators.max(23)]),
			estimateMinutes: new FormControl(null, [Validators.min(0), Validators.max(59)]),
			members: new FormControl([]),
			organizationId: new FormControl(this.userData.organizationId),
			project: new FormControl(null),
			projectId: new FormControl(this.selected.projectId),
			status: new FormControl(TaskStatusEnum.OPEN),
			priority: new FormControl(null),
			size: new FormControl(null),
			tags: new FormControl([]),
			teams: new FormControl([]),
			tenantId: new FormControl(this.userData.tenantId),
			title: new FormControl(null, Validators.required),
			taskStatus: new FormControl(null),
			taskPriority: new FormControl(null),
			taskSize: new FormControl(null),
			organizationContactId: new FormControl(this.selected.contactId),
			organizationTeamId: new FormControl(this.selected.teamId)
		});
		this.hasAddTagPermission$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD))
		);
	}

	public close(res?: any): void {
		this._dialogRef.close(res);
	}

	public async save(): Promise<void> {
		if (this.form.invalid) return;
		this.isSaving = true;
		const {
			estimateDays,
			estimateHours,
			estimateMinutes,
			projectId,
			taskStatus,
			taskPriority,
			taskSize,
			organizationTeamId
		} = this.form.value;
		const days = estimateDays ? estimateDays * 24 * 3600 : 0;
		const hours = estimateHours ? estimateHours * 3600 : 1;
		const minutes = estimateMinutes ? estimateMinutes * 60 : 0;
		const status = taskStatus?.name;
		const size = taskSize?.name;
		const priority = taskPriority?.name;
		const teams = this.teams.filter(({ id }) => id === organizationTeamId);
		const [project] = this.projects.filter(({ id }) => id === projectId);

		try {
			this.form.patchValue({
				members: [...this.employees],
				estimate: days + hours + minutes,
				project,
				status,
				size,
				priority,
				teams
			});

			await this.timeTrackerService.saveNewTask(this.userData, this.form.value);
			this.close({
				isSuccess: true,
				message: this.translate.instant('TOASTR.MESSAGE.CREATED')
			});
		} catch (error) {
			console.log(error);
			this.close({
				isSuccess: false,
				message: error.message
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
				...(organizationContactId ? { contactId: organizationContactId } : {})
			};

			request['members'] = [...this.employees];

			const project = await this.timeTrackerService.createNewProject(request, data);

			this.projects = this.projects.concat([project]);
			this.toastrService.success(
				this.translate.instant('TIMER_TRACKER.TOASTR.PROJECT_ADDED'),
				this._environment.DESCRIPTION
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

	/**
	 * Create new tag
	 *
	 * @param name
	 * @returns
	 */
	public createTag = async (name: ITagCreateInput['name']): Promise<void> => {
		if (!name) {
			return;
		}
		this.isLoading = true;

		const { organizationId, tenantId } = this.store;

		try {
			this.tags = await this._tagService.create({
				name,
				color: ColorAdapter.randomColor(),
				description: '',
				tenantId,
				organizationId
			});
		} catch (error) {
			console.log('Error while creating tags', error);
		} finally {
			this.isLoading = false;
		}
	};
}
