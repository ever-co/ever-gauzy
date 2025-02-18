import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, FormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { EMPTY, firstValueFrom, of, switchMap } from 'rxjs';
import { catchError, debounceTime, filter, finalize, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { uniq } from 'underscore';
import { environment } from '@gauzy/ui-config';
import {
	IOrganization,
	IOrganizationContact,
	ProjectBillingEnum,
	ITag,
	ProjectOwnerEnum,
	TaskListTypeEnum,
	ContactType,
	ICurrency,
	OrganizationProjectBudgetTypeEnum,
	IImageAsset,
	IOrganizationTeam,
	IOrganizationProject,
	PermissionsEnum,
	IIntegrationTenant,
	IGithubRepository,
	IOrganizationProjectSetting,
	IIntegrationMapSyncRepository,
	IOrganizationGithubRepository,
	SYNC_TAG_GAUZY,
	IOrganizationProjectEmployee,
	ID
} from '@gauzy/contracts';
import {
	GithubService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	CompareDateValidator,
	ErrorHandlingService,
	ToastrService,
	Store
} from '@gauzy/ui-core/core';
import { DUMMY_PROFILE_IMAGE, distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { patterns } from '../../regex/regex-patterns.const';
import { FormHelpers } from '../../forms/helpers';
import { ckEditorConfig } from '../../ckeditor.config';
import { ProjectModuleMutationComponent } from '../../project-module/project-module-mutation/project-module-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-mutation',
	templateUrl: './project-mutation.component.html',
	styleUrls: ['./project-mutation.component.scss']
})
export class ProjectMutationComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {
	public FormHelpers: typeof FormHelpers = FormHelpers;
	public OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	public TaskListTypeEnum = TaskListTypeEnum;
	public memberIds: ID[] = [];
	public managerIds: ID[] = [];
	public selectedEmployeeIds: ID[] = [];
	public selectedManagerIds: ID[] = [];
	public selectedTeamIds: ID[] = [];
	public billings: string[] = Object.values(ProjectBillingEnum);
	public owners: ProjectOwnerEnum[] = Object.values(ProjectOwnerEnum);
	public taskViewModeTypes: TaskListTypeEnum[] = Object.values(TaskListTypeEnum);
	public showSprintManage = false;
	public ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;
	public hoverState: boolean;
	public loading: boolean;

	/*
	 * Project Mutation Form
	 */
	public form: UntypedFormGroup = ProjectMutationComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group(
			{
				imageUrl: [],
				imageId: [],
				tags: [],
				teams: [],
				public: [],
				billable: [],
				name: [null, Validators.required],
				organizationContact: [],
				billing: [ProjectBillingEnum.RATE],
				currency: [environment.DEFAULT_CURRENCY],
				startDate: [],
				endDate: [],
				owner: [null, Validators.required],
				memberIds: [[], Validators.required],
				taskListType: [TaskListTypeEnum.GRID],
				description: [],
				code: [],
				color: [],
				budget: [],
				budgetType: [OrganizationProjectBudgetTypeEnum.HOURS],
				openSource: [],
				projectUrl: [null, Validators.compose([Validators.pattern(new RegExp(patterns.websiteUrl))])],
				openSourceProjectUrl: [null, Validators.compose([Validators.pattern(new RegExp(patterns.websiteUrl))])]
			},
			{
				validators: [CompareDateValidator.validateDate('startDate', 'endDate')]
			}
		);
		form.get('teams').setValue([]);
		return form;
	}

	/*
	 * Project Setting Mutation Form
	 */

	public projectSettingForm: UntypedFormGroup = ProjectMutationComponent.buildSettingForm(this._fb);
	static buildSettingForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group({
			isTasksAutoSync: [],
			isTasksAutoSyncOnLabel: [],
			syncTag: []
		});
		return form;
	}

	/**
	 * Represents an integration tenant or a boolean value.
	 */
	private _integration: IIntegrationTenant | boolean;
	get integration(): IIntegrationTenant | boolean {
		// Get the integration tenant or boolean value.
		return this._integration;
	}
	@Input() set integration(value: IIntegrationTenant | boolean) {
		// Set the integration tenant or boolean value.
		this._integration = value;
	}

	/**
	 * Represents an organization project.
	 */
	private _project: IOrganizationProject;
	get project(): IOrganizationProject {
		// Get the organization project.
		return this._project;
	}
	@Input() set project(project: IOrganizationProject) {
		// Set the organization project.
		this._project = project;
	}

	@Input() teams: IOrganizationTeam[] = [];
	@Input() organizationContacts: any[] = [];

	@Output() canceled = new EventEmitter();
	@Output() onSubmitted = new EventEmitter();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true }) actionButtons: TemplateRef<any>;

	public get projectUrl(): AbstractControl {
		return this.form.get('projectUrl');
	}

	public get openSourceProjectUrl(): AbstractControl {
		return this.form.get('openSourceProjectUrl');
	}

	public get projectOrganizationContact(): AbstractControl {
		return this.form.get('organizationContact');
	}

	constructor(
		private readonly _router: Router,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly _errorHandler: ErrorHandlingService,
		private readonly _organizationTeamService: OrganizationTeamsService,
		private readonly _organizationContactService: OrganizationContactService,
		private readonly _githubService: GithubService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _dialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._loadDefaultCurrency()),
				tap(() => this._syncProject()),
				tap(() => this._getOrganizationContacts()),
				tap(() => this._getOrganizationTeams()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Lifecycle hook that is called after the component's view has been initialized.
	 * It sets up an event listener for changes to the 'syncTag' form control.
	 */
	ngAfterViewInit(): void {
		// Get a reference to the 'isTasksAutoSyncOnLabel' form control within the 'projectSettingForm'.
		const isTasksAutoSyncOnLabelControl = <FormControl>this.projectSettingForm.get('isTasksAutoSyncOnLabel');
		const syncTagControl = <FormControl>this.projectSettingForm.get('syncTag');

		isTasksAutoSyncOnLabelControl.valueChanges
			.pipe(
				switchMap((value: boolean) => {
					if (value) {
						syncTagControl.enable();
					} else {
						syncTagControl.disable();
					}
					syncTagControl.updateValueAndValidity();
					return of(value); // Emit the same value.
				}),
				untilDestroyed(this) // Automatically unsubscribe when the component is destroyed.
			)
			.subscribe();
	}

	/**
	 * Load default organization currency
	 */
	private _loadDefaultCurrency() {
		if (!this.organization) {
			return;
		}
		const currency = this.organization.currency || environment.DEFAULT_CURRENCY;
		if (currency) {
			this.form.get('currency').setValue(currency);
			this.form.get('currency').updateValueAndValidity();
		}
	}

	private async _getOrganizationContacts() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		const { items } = await this._organizationContactService.getAll([], {
			organizationId,
			tenantId
		});
		items.forEach((i) => {
			this.organizationContacts = uniq(
				[...this.organizationContacts, { name: i.name, organizationContactId: i.id, id: i.id }],
				'id'
			);
		});
	}

	/**
	 * Get organization teams
	 *
	 * @returns
	 */
	private async _getOrganizationTeams(): Promise<IOrganizationTeam[]> {
		if (
			!this.organization ||
			!this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
		) {
			return;
		}

		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		this.teams = (
			await this._organizationTeamService.getAll([], {
				organizationId,
				tenantId
			})
		).items;
	}

	changeProjectOwner(owner: ProjectOwnerEnum) {
		const clientControl = this.form.get('client');
		const organizationContactControl = this.form.get('organizationContact');
		organizationContactControl.setValidators(owner === ProjectOwnerEnum.CLIENT ? [Validators.required] : null);

		if (owner === ProjectOwnerEnum.INTERNAL && clientControl) {
			clientControl.setValue('');
		}

		organizationContactControl.updateValueAndValidity();
		clientControl?.updateValueAndValidity();
	}

	/**
	 * Sync edit organization project
	 *
	 * @param project
	 */
	private _syncProject() {
		if (!this.project) {
			return;
		}

		const project: IOrganizationProject = this.project;

		// Selected Members Ids
		this.selectedEmployeeIds = (project.members || [])
			.filter((member: IOrganizationProjectEmployee) => !member.isManager)
			.map((member: IOrganizationProjectEmployee) => member.employeeId);

		this.memberIds = this.selectedEmployeeIds;

		// Selected Managers Ids
		this.selectedManagerIds = (project.members || [])
			.filter((member: IOrganizationProjectEmployee) => member.isManager)
			.map((member: IOrganizationProjectEmployee) => member.employeeId);

		this.managerIds = this.selectedManagerIds;

		this.form.patchValue({
			imageUrl: project.imageUrl || null,
			imageId: project.imageId || null,
			tags: project.tags || [],
			public: project.public || false,
			billable: project.billable || false,
			name: project.name || null,
			organizationContact: project.organizationContact || null,
			billing: project.billing || ProjectBillingEnum.RATE,
			currency: project.currency,
			startDate: project.startDate ? new Date(project.startDate) : null,
			endDate: project.endDate ? new Date(project.endDate) : null,
			owner: project.owner || ProjectOwnerEnum.CLIENT,
			memberIds: (project.members || []).map((member: IOrganizationProjectEmployee) => member.id),
			taskListType: project.taskListType || TaskListTypeEnum.GRID,
			description: project.description || null,
			code: project.code || null,
			color: project.color || null,
			budget: project.budget || null,
			budgetType: project.budgetType || OrganizationProjectBudgetTypeEnum.HOURS,
			openSource: project.openSource || null,
			projectUrl: project.projectUrl || null,
			openSourceProjectUrl: project.openSourceProjectUrl || null,
			teams: (this.project.teams || []).map((team: IOrganizationTeam) => team.id)
		});
		this.form.updateValueAndValidity();

		/** Project Integration Setting Patch Value*/
		this.projectSettingForm.patchValue({
			isTasksAutoSync: project.isTasksAutoSync || false,
			isTasksAutoSyncOnLabel: project.isTasksAutoSyncOnLabel || false,
			syncTag: project.syncTag || ''
		});
		this.projectSettingForm.updateValueAndValidity();
	}

	/**
	 * Public toggle action
	 * @param state
	 */
	togglePublic(state: boolean) {
		this.form.get('public').setValue(state);
		this.form.get('public').updateValueAndValidity();
	}

	/**
	 * Billable toggle action
	 * @param state
	 */
	toggleBillable(state: boolean) {
		this.form.get('billable').setValue(state);
		this.form.get('billable').updateValueAndValidity();
	}

	/**
	 * Open source toggle action
	 * @param state
	 */
	toggleOpenSource(state: boolean) {
		this.form.get('openSource').setValue(state);
		this.form.get('openSource').updateValueAndValidity();
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
	 * Handles the selection of members and updates the `memberIds` property.
	 *
	 * @param {ID[]} memberIds - An array of selected member IDs.
	 * The function is called when members are selected, and it sets the `memberIds` property
	 * with the array of selected IDs.
	 */
	onMembersSelected(memberIds: ID[]): void {
		this.memberIds = memberIds;
	}

	/**
	 * Updates the form's teams field with the selected organization teams.
	 *
	 * @param {IOrganizationTeam[]} teams - An array of selected organization teams.
	 */
	onTeamsSelected(teams: IOrganizationTeam[]): void {
		this.form.get('teams').setValue(teams);
		this.form.get('teams').updateValueAndValidity();
	}

	/**
	 * Navigates to the organization projects page, canceling the current project workflow.
	 *
	 * This method is typically called when the user decides to cancel the project creation/edit process.
	 */
	navigateToCancelProject(): void {
		this._router.navigate(['/pages/organization/projects']);
	}

	/**
	 * Handles the submission of the project mutation form.
	 *
	 * @returns void
	 */
	onSubmit(): void {
		if (this.form.invalid) {
			return;
		}

		// Emit the form values
		this.onSubmitted.emit(this.getFormValues());
	}

	/**
	 * Extracts and processes form values for submission.
	 *
	 * @returns {object} - The processed form values.
	 */
	private getFormValues(): object {
		// Destructure the form values in one step
		const {
			name,
			code,
			projectUrl,
			owner,
			organizationContact,
			startDate,
			endDate,
			description,
			tags,
			billing,
			currency,
			budget,
			budgetType,
			openSource,
			openSourceProjectUrl,
			color,
			taskListType,
			public: isPublic,
			billable,
			imageId,
			teams
		} = this.form.value;

		return {
			// Main Step
			name,
			code,
			projectUrl,
			owner,
			organizationContactId: organizationContact?.id || null,
			startDate,
			endDate,
			memberIds: this.memberIds.filter((memberId) => !this.managerIds.includes(memberId)),
			managerIds: this.managerIds,
			teams: teams.map((id) => this.teams.find((team) => team.id === id)).filter(Boolean),

			// Description Step
			description,
			tags: tags || [],

			// Billing Step
			billing,
			billingFlat: [ProjectBillingEnum.RATE, ProjectBillingEnum.FLAT_FEE].includes(billing),
			currency,

			// Budget Step
			budget,
			budgetType,

			// Open Source Step
			openSource,
			openSourceProjectUrl,

			// Setting Step
			color,
			taskListType,
			public: isPublic,
			billable,

			// Image Step
			imageId
		};
	}

	/**
	 * Updates the form's tags field with the selected tags.
	 *
	 * @param {ITag[]} selectedTags - An array of selected tags.
	 */
	selectedTagsEvent(selectedTags: ITag[]): void {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}

	/**
	 * Adds a new organization contact with the provided name.
	 *
	 * @param {string} name - The name of the new organization contact.
	 * @returns {Promise<IOrganizationContact>} - Returns a promise that resolves to the created organization contact.
	 *
	 * @throws {Error} - Handles errors using the error handler service if the contact creation fails.
	 */
	addNewOrganizationContact = async (name: string): Promise<IOrganizationContact> => {
		try {
			const { id: organizationId, tenantId } = this.organization;

			// Create a new organization contact
			const contact: IOrganizationContact = await this._organizationContactService.create({
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT
			});

			// Display a success message if the contact is created
			if (contact) {
				const { name } = contact;
				this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', { name });
			}
			return contact;
		} catch (error) {
			// Handle any errors that occur during the contact creation process
			this._errorHandler.handleError(error);
		}
	};

	/**
	 * Navigates to the tasks settings page for the selected project.
	 */
	openTasksSettings(): void {
		// Get the selected project
		const project = this.project;
		// Navigate to the tasks settings page with the selected project
		this._router.navigate(['/pages/tasks/settings', project.id], { state: project });
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {
		// Added to avoid lint error.
		// TODO: To be removed after clarifying the logic.
		console.log($event);
	}

	/**
	 * Upload project logo
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image && image.id) {
				this.form.get('imageId').setValue(image.id);
				this.form.get('imageUrl').setValue(image.fullUrl);
			} else {
				this.form.get('imageUrl').setValue(DUMMY_PROFILE_IMAGE);
			}
			this.form.updateValueAndValidity();
		} catch (error) {
			console.log('Error while uploading project logo', error);
			this.handleImageUploadError(error);
		}
	}

	handleImageUploadError(error: any) {
		this._toastrService.danger(error);
	}

	/**
	 * Selects a GitHub repository and retrieves its associated issues.
	 * @param repository - The GitHub repository to select.
	 */
	public selectRepository(repository: IGithubRepository) {
		if (!this.organization || !this.integration) {
			return;
		}
		/**  */
		try {
			this.loading = false;

			const { id: organizationId, tenantId } = this.organization;
			const { id: projectId, name } = this.project;
			const integrationId = this.integration['id'];

			/** */
			const request: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository
			};
			// Fetch entity settings by integration ID and handle the result as an observable
			this._githubService
				.syncGithubRepository(request)
				.pipe(
					switchMap(({ id: repositoryId }: IOrganizationGithubRepository) => {
						return this._organizationProjectsService.updateProjectSetting(projectId, {
							organizationId,
							tenantId,
							customFields: { repositoryId },
							...(!this.projectSettingForm.get('syncTag').value ? { syncTag: SYNC_TAG_GAUZY } : {})
						});
					}),
					tap(() => {
						this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.SYNC_REPOSITORY', {
							repository: repository.full_name,
							project: name
						});
					}),
					catchError((error) => {
						this._errorHandler.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => {
						// Set the 'loading' flag to false to indicate that data loading is complete
						this.loading = false;
					}),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			this._errorHandler.handleError(error);
		}
	}

	/**
	 * Trigger a change in the synchronization tag for project auto-sync settings.
	 * This function updates the project's auto-sync settings.
	 */
	public changeSyncTag() {
		this.updateProjectAutoSyncSetting();
	}

	/**
	 * Updates project auto-sync settings.
	 * This method is typically invoked in response to user actions.
	 */
	public updateProjectAutoSyncSetting() {
		// Check if the 'organization' or 'integration' properties are not available.
		if (!this.organization || !this.integration) {
			return; // Abort the method execution.
		}

		/**  */
		try {
			// Set the 'loading' property to 'false' to indicate that data loading is not in progress.
			this.loading = false;

			// Extract the 'organizationId' and 'tenantId' from the 'organization' property.
			const { id: organizationId, tenantId } = this.organization;

			// Extract the 'projectId' from the 'project' property.
			const { id: projectId, name } = this.project;

			// Create a 'request' object of type 'IOrganizationProjectSetting'.
			// It contains 'organizationId', 'tenantId', and auto-sync settings taken from 'this.projectSettingForm.value'.
			const request: IOrganizationProjectSetting = {
				organizationId,
				tenantId,
				...this.projectSettingForm.value
			};

			// Call the 'updateProjectSetting' method of the '_organizationProjectsService'
			// to update project settings with 'projectId' and the 'request'
			this._organizationProjectsService
				.updateProjectSetting(projectId, request)
				.pipe(
					tap(() => {
						const message = 'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.AUTO_SYNC_SETTING';
						this._toastrService.success(message, { project: name });
					}),
					catchError((error) => {
						this._errorHandler.handleError(error);
						return EMPTY;
					}),
					// Execute the following code block when the observable completes or errors
					finalize(() => {
						// Set the 'loading' flag to false to indicate that data loading is complete
						this.loading = false;
					}),
					// Automatically unsubscribe when the component is destroyed
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			this._errorHandler.handleError(error);
		}
	}

	/**
	 * Opens a dialog for creating a new project module
	 * @param createModule - Flag indicating if this is a new module creation (true) or edit (false)
	 * @returns Promise that resolves when the dialog is closed
	 */
	public async createProjectModuleDialog(): Promise<void> {
		try {
			await firstValueFrom(
				this._dialogService.open(ProjectModuleMutationComponent, {
					context: {
						project: this.project,
						createModule: true
					}
				}).onClose
			);
		} catch (error) {
			const message = error.message || 'Error while creating project module';
			this._toastrService.danger(message, 'Project Module Error');
		}
	}
}
