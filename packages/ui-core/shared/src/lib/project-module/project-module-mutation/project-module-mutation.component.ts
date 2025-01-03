import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEmployee,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationTeam,
	ITask,
	ProjectModuleStatusEnum,
	TaskParticipantEnum,
	ID,
	IOrganizationProjectModuleEmployee
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	EmployeesService,
	OrganizationTeamsService,
	Store,
	OrganizationProjectModuleService,
	SprintService,
	TasksService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { richTextCKEditorConfig } from '../../ckeditor.config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-project-module-mutation',
	templateUrl: './project-module-mutation.component.html',
	styleUrl: './project-module-mutation.component.scss'
})
export class ProjectModuleMutationComponent extends TranslationBaseComponent implements OnInit {
	memberIds: ID[] = [];
	managerIds: ID[] = [];
	selectedEmployeeIds: ID[] = [];
	selectedManagerIds: ID[] = [];
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedTeams: string[] = [];
	tasks: ITask[] = [];
	organizationSprints: IOrganizationSprint[] = [];
	availableParentModules: IOrganizationProjectModule[] = [];
	organization: IOrganization;
	taskParticipantEnum = TaskParticipantEnum;
	participants = TaskParticipantEnum.EMPLOYEES;
	ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	projectModuleStatuses = Object.values(ProjectModuleStatusEnum);
	form: UntypedFormGroup = this.fb.group({
		name: ['', Validators.required],
		description: [''],
		status: [ProjectModuleStatusEnum.BACKLOG],
		startDate: ['', Validators.required],
		endDate: ['', Validators.required],
		isFavorite: [false],
		parentId: [],
		projectId: [null, Validators.required],
		managerIds: [],
		memberIds: [],
		organizationSprints: [],
		teams: [],
		tasks: []
	});

	@Input() createModule = false;

	private _projectModule: IOrganizationProjectModule;
	get projectModule(): IOrganizationProjectModule {
		return this._projectModule;
	}
	@Input() set projectModule(value: IOrganizationProjectModule) {
		this._projectModule = value;
		this.populateForm(value);
	}

	private _project: IOrganizationProject;
	get project(): IOrganizationProject {
		return this._project;
	}
	@Input() set project(value: IOrganizationProject) {
		this._project = value;
		this.form.get('projectId').setValue(value?.id || null);
	}

	constructor(
		public dialogRef: NbDialogRef<ProjectModuleMutationComponent>,
		private fb: UntypedFormBuilder,
		private store: Store,
		public translateService: TranslateService,
		private employeesService: EmployeesService,
		private organizationTeamsService: OrganizationTeamsService,
		private organizationProjectModuleService: OrganizationProjectModuleService,
		private organizationSprintService: SprintService,
		private readonly tasksService: TasksService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	/**
	 * Initializes component and loads necessary data.
	 */
	ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		this.loadOrganizationData();
		this.loadAvailableParentModules();
		this.loadTasks();
		this.findOrganizationSprints();
	}

	/**
	 * Populates form fields with data from an existing project module.
	 * @param module - The selected project module data.
	 */
	private populateForm(module: IOrganizationProjectModule): void {
		if (!module) return;

		const {
			name,
			description,
			status,
			startDate,
			endDate,
			isFavorite,
			projectId,
			parentId,
			members = [],
			organizationSprints,
			teams = [],
			tasks = []
		} = module;

		this.form.patchValue({
			name,
			description,
			status,
			startDate,
			endDate,
			isFavorite,
			projectId,
			parentId,
			members: members.map((m) => m.id),
			organizationSprints,
			teams: teams.map((t) => t.id),
			tasks: tasks.map((task) => task.id)
		});

		this.selectedEmployeeIds = (module.members || [])
			.filter((member: IOrganizationProjectModuleEmployee) => !member.isManager)
			.map((member: IOrganizationProjectModuleEmployee) => member.employeeId);

		this.memberIds = this.selectedEmployeeIds;

		// Selected Managers Ids
		this.selectedManagerIds = (module.members || [])
			.filter((member: IOrganizationProjectModuleEmployee) => member.isManager)
			.map((member: IOrganizationProjectModuleEmployee) => member.employeeId);

		this.managerIds = this.selectedManagerIds;

		this.selectedTeams = teams.map((t) => t.id);
	}

	/**
	 * Validates and saves the form data to create or update the project module.
	 */
	onSave() {
		if (this.form.invalid) return;
		this.createOrUpdateModule();
	}

	/**
	 * Creates a new project module or updates the existing module based on form data.
	 */
	private async createOrUpdateModule() {
		try {
			// Update form fields with valid members, teams, and tasks
			this.updateFormFields();

			// Prepare form values
			const formValue = {
				...this.form.value,
				organizationId: this.organization.id,
				organization: this.organization
			};

			let module: IOrganizationProjectModule;

			// Determine if we are creating or updating a module
			if (this.createModule) {
				module = await firstValueFrom(this.organizationProjectModuleService.create(formValue));
				this.toastrService.success(
					this.translateService.instant('TOASTR.MESSAGE.MODULE_CREATED'),
					this.translateService.instant('TOASTR.TITLE.SUCCESS')
				);
			} else {
				module = await firstValueFrom(
					this.organizationProjectModuleService.update(this.projectModule.id, formValue)
				);
				this.toastrService.success(
					this.translateService.instant('TOASTR.MESSAGE.MODULE_UPDATED'),
					this.translateService.instant('TOASTR.TITLE.SUCCESS')
				);
			}

			// Close the dialog and return the created/updated module
			this.dialogRef.close(module);
		} catch (error) {
			// Display an error toast
			this.toastrService.danger(
				this.translateService.instant('TOASTR.MESSAGE.MODULE_SAVE_ERROR'),
				this.translateService.instant('TOASTR.TITLE.ERROR')
			);
			console.error('Failed to save module:', error);
		}
	}

	/**
	 * Updates form fields with valid members, teams, and tasks.
	 */
	private updateFormFields() {
		this.form.get('memberIds').setValue(this.memberIds.filter((memberId) => !this.managerIds.includes(memberId)));

		this.form
			.get('managerIds')
			.setValue(this.managerIds.filter((managerId) => this.employees.some((emp) => emp.id === managerId)));

		this.form
			.get('teams')
			.setValue((this.selectedTeams || []).map((id: ID) => this.teams.find((t) => t.id === id)).filter(Boolean));

		this.form
			.get('tasks')
			.setValue(
				(this.form.get('tasks').value || [])
					.map((id: ID) => this.tasks.find((t) => t.id === id))
					.filter(Boolean)
			);
	}

	/**
	 * Loads selected organization data and initializes employees and teams.
	 */
	async loadOrganizationData() {
		const organization$ = this.store.selectedOrganization$;
		organization$
			.pipe(
				distinctUntilChange(),
				filter(Boolean),
				tap((org: IOrganization) => (this.organization = org)),
				tap(() => this.loadEmployees()),
				tap(() => this.loadTeams()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads the employees for the currently selected organization.
	 *
	 * Retrieves all employees associated with the current organization and tenant,
	 * including their user details, and assigns them to the `employees` property.
	 */
	async loadEmployees(): Promise<void> {
		if (!this.organization) return;

		const { id: organizationId, tenantId } = this.organization;

		try {
			const { items: employees = [] } = await firstValueFrom(
				this.employeesService.getAll(['user'], { organizationId, tenantId })
			);
			this.employees = employees;
		} catch (error) {
			console.error('Failed to load employees:', error);
			this.employees = [];
		}
	}

	/**
	 * Loads available teams for the selected organization.
	 *
	 * Retrieves all teams associated with the current organization and tenant,
	 * including their members, and assigns them to the `teams` property.
	 */
	async loadTeams(): Promise<void> {
		if (!this.organization) return;

		const { id: organizationId, tenantId } = this.organization;

		try {
			const { items: teams = [] } = await this.organizationTeamsService.getAll(['members'], {
				organizationId,
				tenantId
			});
			this.teams = teams;
		} catch (error) {
			this.teams = [];
		}
	}

	/**
	 * Loads available tasks for the selected project and organization.
	 *
	 * Retrieves all tasks associated with the current organization, tenant,
	 * and selected project, then assigns them to the `tasks` property.
	 */
	async loadTasks(): Promise<void> {
		if (!this.organization) return;

		const { id: organizationId, tenantId } = this.organization;
		const projectId = this.form.get('projectId')?.value;

		try {
			const { items: tasks = [] } = await firstValueFrom(
				this.tasksService.getAllTasks({ projectId, organizationId, tenantId })
			);
			this.tasks = tasks;
		} catch (error) {
			this.tasks = [];
		}
	}

	/**
	 * Loads available parent modules based on the selected project ID.
	 *
	 * Retrieves parent modules associated with the selected project and assigns
	 * them to the `availableParentModules` property.
	 */
	private async loadAvailableParentModules(): Promise<void> {
		if (!this.organization) return;

		const projectId = this.form.get('projectId')?.value;

		try {
			const modules = await firstValueFrom(
				this.organizationProjectModuleService.getAllModulesByProjectId({ projectId })
			);
			this.availableParentModules = modules?.items || [];
		} catch (error) {
			this.availableParentModules = [];
		}
	}

	/**
	 * Fetches sprints associated with the organization.
	 */
	findOrganizationSprints(): void {
		this.organizationSprintService.getAllSprints().subscribe({
			next: (sprints) => {
				this.organizationSprints = sprints.items;
			},
			error: (error) => {
				console.error('Error fetching organization sprints:', error);
			}
		});
	}

	/**
	 * Handles the selection of managers and updates the `managerIds` property.
	 *
	 * @param {ID[]} managerIds - An array of selected manager IDs.
	 * The function is called when managers are selected, and it sets the `managerIds` property
	 * with the array of selected IDs.
	 */
	onManagersSelected(managerIds: ID[]): void {
		this.managerIds = managerIds;
	}

	/**
	 * Updates the selected teams based on the user's selection.
	 *
	 * @param teamsSelection - An array of team IDs selected by the user.
	 */
	onTeamsSelected(teamsSelection: ID[]): void {
		this.selectedTeams = [...teamsSelection];
	}

	/**
	 * Handles the selection of members and updates the `memberIds` property.
	 *
	 * @param {ID[]} memberIds - An array of selected member IDs.
	 * The function is called when members are selected, and it sets the `memberIds` property
	 * with the array of selected IDs.
	 */
	onMembersSelected(memberIds: ID[]): void {
		this.memberIds = memberIds;
	}
}
