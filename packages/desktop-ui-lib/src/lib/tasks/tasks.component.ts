import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, UntypedFormGroup, Validators } from '@angular/forms';
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
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';;
import { combineLatest, concatMap, from, map, Observable, startWith, tap } from 'rxjs';
import { Store, TagService } from '../services';
import { ClientSelectorService } from '../shared/features/client-selector/+state/client-selector.service';
import { ProjectSelectorService } from '../shared/features/project-selector/+state/project-selector.service';
import { TeamSelectorService } from '../shared/features/team-selector/+state/team-selector.service';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
import { CkEditorConfig, ColorAdapter } from '../utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-tasks',
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit {
	@Input() userData: IUserOrganization = this.store.user as any;
	@Input() employee: IEmployee = this.store.user.employee;
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
		private translate: TranslateService,
		private store: Store,
		private _dialogRef: NbDialogRef<TasksComponent>,
		private _tagService: TagService,
		private readonly clientSelectorService: ClientSelectorService,
		private readonly teamSelectorService: TeamSelectorService,
		private readonly projectSelectorService: ProjectSelectorService
	) {
		this.isSaving = false;
	}

	private async _tags(): Promise<void> {
		try {
			this.tags = await this._tagService.getTags();
		} catch (error) {
			console.error('[error]', 'while get tags::' + error.message);
		}
	}

	private async _employees(): Promise<void> {
		try {
			const { organizationId, user, tenantId } = this.store;
			const employeeId = user.employee.id;
			const employee = await this.timeTrackerService.getEmployees({ employeeId, organizationId, tenantId });
			this.employees = [employee];
		} catch (error) {
			console.error('[error]', 'while get employees::' + error.message);
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
		const { organizationId, tenantId } = this.store;
		this.editorConfig.editorplaceholder = this.translate.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		this.taskStatuses = this.store.statuses;
		from(Promise.allSettled([this._tags(), this._employees(), this._sizes(), this._priorities()]))
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
			organizationId: new FormControl(organizationId),
			project: new FormControl(null),
			projectId: new FormControl(this.projectSelectorService.selectedId),
			status: new FormControl(TaskStatusEnum.OPEN),
			priority: new FormControl(null),
			size: new FormControl(null),
			tags: new FormControl([]),
			teams: new FormControl([]),
			tenantId: new FormControl(tenantId),
			title: new FormControl(null, Validators.required),
			taskStatus: new FormControl(null),
			taskPriority: new FormControl(null),
			taskSize: new FormControl(null),
			organizationContactId: new FormControl(this.clientSelectorService.selectedId),
			organizationTeamId: new FormControl(this.teamSelectorService.selectedId)
		});
		this.hasAddTagPermission$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD))
		);
		combineLatest([
			this.form.get('organizationContactId').valueChanges.pipe(startWith(this.clientSelectorService.selectedId)),
			this.form.get('organizationTeamId').valueChanges.pipe(startWith(this.teamSelectorService.selectedId))
		])
			.pipe(
				tap(() => this.projectSelectorService.resetPage()),
				concatMap(([organizationContactId, organizationTeamId]) =>
					this.projectSelectorService.load({ organizationContactId, organizationTeamId })
				),
				untilDestroyed(this)
			)
			.subscribe();
		this.form
			.get('projectId')
			.valueChanges.pipe(
				tap(() => this.teamSelectorService.resetPage()),
				concatMap((projectId) => this.teamSelectorService.load({ projectId })),
				untilDestroyed(this)
			)
			.subscribe();
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
		const { user } = this.store;
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

			await this.timeTrackerService.saveNewTask(user, this.form.value);
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
