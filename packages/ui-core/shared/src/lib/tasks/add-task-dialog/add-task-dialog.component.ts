import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import * as moment from 'moment';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	IEmployee,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationTeam,
	ISelectedEmployee,
	ITag,
	ITask,
	TaskParticipantEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EmployeesService,
	OrganizationProjectModuleService,
	OrganizationTeamsService,
	Store,
	TasksService
} from '@gauzy/ui-core/core';
import { richTextCKEditorConfig } from '../../ckeditor.config';
import { FormHelpers } from '../../forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-task-dialog',
	templateUrl: './add-task-dialog.component.html',
	styleUrls: ['./add-task-dialog.component.scss']
})
export class AddTaskDialogComponent extends TranslationBaseComponent implements OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[] = [];
	selectedTeams: string[] = [];
	selectedModules: string[] = [];
	selectedTask: ITask;
	availableModules: IOrganizationProjectModule[] = [];
	organization: IOrganization;
	taskParticipantEnum = TaskParticipantEnum;
	participants = TaskParticipantEnum.EMPLOYEES;
	public ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	@Input() createTask = false;
	/*
	 * Payment Mutation Form
	 */
	public form: UntypedFormGroup = AddTaskDialogComponent.buildForm(this.fb);

	constructor(
		public readonly dialogRef: NbDialogRef<AddTaskDialogComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly tasksService: TasksService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private organizationProjectModuleService: OrganizationProjectModuleService
	) {
		super(translateService);
	}

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			number: [{ value: '', disabled: true }],
			title: [null, Validators.required],
			project: [],
			projectId: [null, Validators.required],
			status: [TaskStatusEnum.OPEN, Validators.required],
			priority: [],
			size: [],
			members: [],
			estimateDays: [],
			estimateHours: [null, [Validators.min(0), Validators.max(23)]],
			estimateMinutes: [null, [Validators.min(0), Validators.max(59)]],
			dueDate: [],
			description: [],
			tags: [],
			teams: [],
			modules: [],
			taskStatus: [],
			taskSize: [],
			taskPriority: []
		});
	}

	/*
	 * Getter & Setter for task
	 */
	_task: ITask;

	get task(): ITask {
		return this._task;
	}

	@Input() set task(value: ITask) {
		this.selectedTask = value;
		this._task = value;
	}

	ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		storeOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.loadEmployees()),
				tap(() => this.loadTeams()),
				tap(() => this.loadAvailableModules()),
				tap(() => this.initializeForm()),

				untilDestroyed(this)
			)
			.subscribe();
		storeEmployee$
			.pipe(
				distinctUntilChange(),
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				tap((employee: ISelectedEmployee) => {
					if (!this.selectedTask) {
						this.selectedMembers.push(employee.id);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		storeProject$
			.pipe(
				distinctUntilChange(),
				filter((project: IOrganizationProject) => !!project && !!project.id),
				tap((project: IOrganizationProject) => {
					if (!this.selectedTask) {
						this.form.get('project').setValue(project);
						this.form.get('projectId').setValue(project.id);
						this.form.updateValueAndValidity();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.form
			.get('projectId')
			.valueChanges.pipe(untilDestroyed(this))
			.subscribe(() => this.loadAvailableModules());
	}

	initializeForm() {
		if (this.selectedTask) {
			const {
				description,
				dueDate,
				estimate,
				members,
				project,
				status,
				tags,
				teams,
				title,
				priority,
				size,
				taskStatus,
				taskSize,
				modules,
				taskPriority
			} = this.selectedTask;
			const duration = moment.duration(estimate, 'seconds');

			this.selectedMembers = (members || []).map((member) => member.id);
			this.selectedTeams = (teams || []).map((team) => team.id);
			this.selectedModules = (modules || []).map((module) => module.id);

			if (teams && teams.length > 0) {
				this.participants = TaskParticipantEnum.TEAMS;
			}

			this.form.patchValue({
				title,
				project,
				projectId: project ? project.id : null,
				status,
				priority,
				size,
				estimateDays: duration.days(),
				estimateHours: duration.hours(),
				estimateMinutes: duration.minutes(),
				dueDate: dueDate ? new Date(dueDate) : null,
				description,
				tags,
				teams: this.selectedTeams,
				members: this.selectedMembers,
				modules: this.selectedModules,
				taskStatus,
				taskSize,
				taskPriority
			});
		}
	}

	onSave() {
		if (this.form.valid) {
			// Reset both fields to ensure only one is sent based on the selection
			this.form.get('members').setValue([]);
			this.form.get('teams').setValue([]);

			if (this.participants === TaskParticipantEnum.EMPLOYEES) {
				this.form.get('members').setValue(
					(this.selectedMembers || []).map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e) // Only valid employees
				);
			} else if (this.participants === TaskParticipantEnum.TEAMS) {
				this.form.get('teams').setValue(
					(this.selectedTeams || []).map((id) => this.teams.find((e) => e.id === id)).filter((e) => !!e) // Only valid teams
				);
			}

			const selectedModules = this.selectedModules || [];
			const mappedModules = selectedModules
				.map((id) => this.availableModules?.find((e) => e?.id === id))
				.filter(Boolean);
			this.form.get('modules')?.setValue(mappedModules);
			this.form.get('projectId').setValue(this.form.get('projectId').value);
			this.form.get('status').setValue(this.form.get('taskStatus').value?.name);
			this.form.get('priority').setValue(this.form.get('taskPriority').value?.name);
			this.form.get('size').setValue(this.form.get('taskSize').value?.name);
			const { estimateDays, estimateHours, estimateMinutes } = this.form.value;

			const estimate = estimateDays * 24 * 60 * 60 + estimateHours * 60 * 60 + estimateMinutes * 60;

			this.form.value.estimate = estimate || null;

			if (this.createTask) {
				firstValueFrom(this.tasksService.createTask(this.form.value)).then((task) => {
					this.dialogRef.close(task);
				});
			} else {
				this.dialogRef.close(this.form.value);
			}
		}
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	selectedProject(project: IOrganizationProject) {
		this.form.get('project').setValue(project);
		this.form.get('project').updateValueAndValidity();
	}

	async loadEmployees() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organizationId,
				tenantId
			})
		);
		this.employees = items;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}

	async loadTeams() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.organizationTeamsService.getAll(['members'], { organizationId, tenantId });
		this.teams = items;
	}

	onParticipantsChange(participants: TaskParticipantEnum) {
		this.participants = participants;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}

	onModulesSelected(modules: string[]) {
		this.selectedModules = modules;
	}

	/**
	 * Loads available modules based on the selected project ID.
	 */
	private async loadAvailableModules() {
		if (!this.organization || !this.form.get('projectId')?.value) return;
		const modules = await firstValueFrom(
			this.organizationProjectModuleService.getAllModulesByProjectId({
				projectId: this.form.get('projectId')?.value
			})
		);

		this.availableModules = modules?.items || [];
	}
}
