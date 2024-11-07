import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	IEmployee,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationTeam,
	ISelectedEmployee,
	ProjectModuleStatusEnum,
	TaskParticipantEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EmployeesService,
	OrganizationTeamsService,
	Store,
	OrganizationProjectModuleService,
	SprintService
} from '@gauzy/ui-core/core';
import { richTextCKEditorConfig } from '../../../ckeditor.config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-module-dialog',
	templateUrl: './add-project-module-dialog.component.html',
	styleUrls: ['./add-project-module-dialog.component.scss']
})
export class AddProjectModuleDialogComponent extends TranslationBaseComponent implements OnInit {
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[] = [];
	selectedTeams: string[] = [];
	organizationSprints: IOrganizationSprint[] = [];
	availableParentModules: IOrganizationProjectModule[] = [];
	organization: IOrganization;
	taskParticipantEnum = TaskParticipantEnum;
	participants = TaskParticipantEnum.EMPLOYEES;
	ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	@Input() createModule = false;

	form: UntypedFormGroup = AddProjectModuleDialogComponent.buildForm(this.fb);
	projectModuleStatuses = Object.values(ProjectModuleStatusEnum);

	constructor(
		public dialogRef: NbDialogRef<AddProjectModuleDialogComponent>,
		private fb: UntypedFormBuilder,
		private store: Store,
		public translateService: TranslateService,
		private employeesService: EmployeesService,
		private organizationTeamsService: OrganizationTeamsService,
		private organizationProjectModuleService: OrganizationProjectModuleService,
		private organizationSprintService: SprintService
	) {
		super(translateService);
	}

	/**
	 * Initializes the form structure with default values and validators.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: ['', Validators.required],
			description: [''],
			status: [ProjectModuleStatusEnum.BACKLOG],
			startDate: ['', Validators.required],
			endDate: ['', Validators.required],
			isFavorite: [false],
			parentId: [],
			projectId: [null, Validators.required],
			managerId: [],
			members: [],
			organizationSprints: [],
			teams: [],
			tasks: []
		});
	}

	private _projectModule: IOrganizationProjectModule;
	@Input()
	get projectModule(): IOrganizationProjectModule {
		return this._projectModule;
	}
	set projectModule(value: IOrganizationProjectModule) {
		this._projectModule = value;

		this.populateForm(value);
	}

	private _project: IOrganizationProject;
	@Input()
	get project(): IOrganizationProject {
		return this._project;
	}
	set project(value: IOrganizationProject) {
		this._project = value;
		this.form.get('projectId').setValue(value?.id || null);
	}

	/**
	 * Initializes component and loads necessary data.
	 */
	ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		this.loadOrganizationData();
		this.loadAvailableParentModules();
		this.findOrganizationSprints();
	}

	/**
	 * Populates form fields with data from an existing project module.
	 * @param module - The selected project module data.
	 */
	private populateForm(module: IOrganizationProjectModule) {
		if (!module) return;
		this.form.patchValue({
			name: module.name,
			description: module.description,
			status: module.status,
			startDate: module.startDate,
			endDate: module.endDate,
			isFavorite: module.isFavorite,
			projectId: module.projectId,
			parentId: module.parentId,
			managerId: module.managerId,
			members: (module.members || []).map((m) => m.id),
			organizationSprints: module.organizationSprints,
			teams: (module.teams || []).map((t) => t.id),
			tasks: module.tasks
		});
		this.selectedMembers = module.members.map((m) => m.id);
		this.selectedTeams = module.teams.map((t) => t.id);
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
		const organizationId = this.organization.id;
		const formValue = { ...this.form.value, organizationId, organization: this.organization };

		if (this.createModule) {
			const module = await firstValueFrom(this.organizationProjectModuleService.create(formValue));
			this.dialogRef.close(module);
		} else {
			this.dialogRef.close(formValue);
		}
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
	 * Loads available employees for the selected organization.
	 */
	async loadEmployees() {
		if (!this.organization) return;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items = [] } = await firstValueFrom(
			this.employeesService.getAll(['user'], { organizationId, tenantId })
		);
		this.employees = items;
	}

	/**
	 * Loads available teams for the selected organization.
	 */
	async loadTeams() {
		if (!this.organization) return;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items = [] } = await this.organizationTeamsService.getAll(['members'], { organizationId, tenantId });
		this.teams = items;
	}

	/**
	 * Loads available parent modules based on the selected project ID.
	 */
	private async loadAvailableParentModules() {
		if (!this.organization) return;
		const modules = await firstValueFrom(
			this.organizationProjectModuleService.get<IOrganizationProjectModule>({
				projectId: this.form.get('projectId')?.value
			})
		);
		this.availableParentModules = modules?.items || [];
	}

	/**
	 * Fetches sprints associated with the organization.
	 */
	findOrganizationSprints() {
		this.organizationSprintService.getAllSprints().subscribe(
			(sprints) => (this.organizationSprints = sprints.items),
			(error) => console.error('Error fetching organization sprints:', error)
		);
	}

	/**
	 * Updates the selected manager ID in the form.
	 * @param selectedManagerId - The selected manager's ID.
	 */
	onManagerSelected(employee: ISelectedEmployee) {
		// Check if the provided value is an array; if so, take the first element, otherwise use the value directly
		this.form.get('managerId').setValue(employee.id);
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}
}
