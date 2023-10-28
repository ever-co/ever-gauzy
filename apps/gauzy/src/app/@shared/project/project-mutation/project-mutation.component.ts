import {
	AfterViewInit,
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { EMPTY, of, switchMap } from 'rxjs';
import { catchError, debounceTime, filter, finalize, tap } from 'rxjs/operators';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { uniq } from 'underscore';
import { environment } from '@env/environment';
import {
	IEmployee,
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
	HttpStatus,
	IIntegrationMapSyncRepository,
	IOrganizationGithubRepository,
	SYNC_TAG_GAUZY
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { patterns } from '../../regex/regex-patterns.const';
import {
	ErrorHandlingService,
	GithubService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { DUMMY_PROFILE_IMAGE } from '../../../@core/constants';
import { CompareDateValidator } from '../../../@core/validators';
import { FormHelpers } from '../../forms/helpers';
import { ckEditorConfig } from "../../ckeditor.config";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-mutation',
	templateUrl: './project-mutation.component.html',
	styleUrls: ['./project-mutation.component.scss']
})
export class ProjectMutationComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit {

	public FormHelpers: typeof FormHelpers = FormHelpers;
	public OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	public TaskListTypeEnum = TaskListTypeEnum;
	public members: string[] = [];
	public selectedEmployeeIds: string[] = [];
	public selectedTeamIds: string[] = [];
	public billings: string[] = Object.values(ProjectBillingEnum);
	public owners: ProjectOwnerEnum[] = Object.values(ProjectOwnerEnum);
	public taskViewModeTypes: TaskListTypeEnum[] = Object.values(TaskListTypeEnum);
	public showSprintManage = false;
	public ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;
	public employees: IEmployee[] = [];
	public hoverState: boolean;
	public loading: boolean;

	/*
	* Project Mutation Form
	*/
	public form: FormGroup = ProjectMutationComponent.buildForm(this._fb);
	static buildForm(fb: FormBuilder): FormGroup {
		const form = fb.group({
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
			owner: [ProjectOwnerEnum.CLIENT],
			taskListType: [TaskListTypeEnum.GRID],
			description: [],
			code: [],
			color: [],
			budget: [],
			budgetType: [OrganizationProjectBudgetTypeEnum.HOURS],
			openSource: [],
			projectUrl: [
				null,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			openSourceProjectUrl: [
				null,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			]
		}, {
			validators: [
				CompareDateValidator.validateDate('startDate', 'endDate')
			]
		});
		form.get('teams').setValue([]);
		return form;
	}

	/*
	* Project Setting Mutation Form
	*/

	public projectSettingForm: FormGroup = ProjectMutationComponent.buildSettingForm(this._fb);
	static buildSettingForm(fb: FormBuilder): FormGroup {
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
	get integration(): IIntegrationTenant | boolean { // Get the integration tenant or boolean value.
		return this._integration;
	}
	@Input() set integration(value: IIntegrationTenant | boolean) { // Set the integration tenant or boolean value.
		this._integration = value;
	}

	/**
	 * Represents an organization project.
	 */
	private _project: IOrganizationProject;
	get project(): IOrganizationProject { // Get the organization project.
		return this._project;
	}
	@Input() set project(project: IOrganizationProject) { // Set the organization project.
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

	constructor(
		private readonly _router: Router,
		private readonly _fb: FormBuilder,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly _errorHandler: ErrorHandlingService,
		private readonly _organizationTeamService: OrganizationTeamsService,
		private readonly _organizationContactService: OrganizationContactService,
		private readonly _githubService: GithubService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
	) {
		super(translateService);
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
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
			this.organizationContacts = uniq([
				...this.organizationContacts,
				{ name: i.name, organizationContactId: i.id, id: i.id }
			], 'id');
		});
	}

	/**
	 * Get organization teams
	 *
	 * @returns
	 */
	private async _getOrganizationTeams(): Promise<IOrganizationTeam[]> {
		if (!this.organization || !this._store.hasAnyPermission(
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TEAM_VIEW
		)) {
			return;
		}

		const { tenantId } = this._store.user;
		const { id: organizationId } = this.organization;

		this.teams = (await this._organizationTeamService.getAll(
			[],
			{
				organizationId,
				tenantId
			}
		)).items;
	}

	changeProjectOwner(owner: ProjectOwnerEnum) {
		const clientControl = this.form.get('client');
		if (owner === ProjectOwnerEnum.INTERNAL && clientControl) {
			clientControl.setValue('');
		}
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
		this.selectedEmployeeIds = project.members.map(
			(member: IEmployee) => member.id
		);

		this.members = this.selectedEmployeeIds;
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
			taskListType: project.taskListType || TaskListTypeEnum.GRID,
			description: project.description || null,
			code: project.code || null,
			color: project.color || null,
			budget: project.budget || null,
			budgetType: project.budgetType || OrganizationProjectBudgetTypeEnum.HOURS,
			openSource: project.openSource || null,
			projectUrl: project.projectUrl || null,
			openSourceProjectUrl: project.openSourceProjectUrl || null,
			teams: this.project.teams.map((team: IOrganizationTeam) => team.id),

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

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	onTeamsSelected(teams: IOrganizationTeam[]) {
		this.form.get('teams').setValue(teams);
		this.form.get('teams').updateValueAndValidity();
	}

	/**
	 *
	 */
	navigateToCancelProject() {
		this._router.navigate([`/pages/organization/projects`]);
	}

	/**
	 * On submit project mutation form
	 *
	 * @returns
	 */
	onSubmit() {
		if (this.form.invalid) {
			return;
		}

		const { name, code, projectUrl, owner, organizationContact, startDate, endDate } = this.form.value;
		const { description, tags } = this.form.value;
		const { billing, currency } = this.form.value;
		const { budget, budgetType } = this.form.value;
		const { openSource, openSourceProjectUrl } = this.form.value;
		const { color, taskListType, public: isPublic, billable } = this.form.value;
		const { imageId } = this.form.value;

		this.onSubmitted.emit({
			// Main Step
			name: name,
			code: code,
			projectUrl: projectUrl,
			owner: owner,
			organizationContactId: organizationContact ? organizationContact.id : null,
			startDate: startDate,
			endDate: endDate,
			members: this.members.map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e),
			teams: this.form.get('teams').value.map((id) => this.teams.find((e) => e.id === id)).filter((e) => !!e),
			// Description Step
			description: description,
			tags: tags || [],

			// Billing Step
			billing: billing,
			billingFlat: (billing === ProjectBillingEnum.RATE) || (billing === ProjectBillingEnum.FLAT_FEE) ? true : false,
			currency: currency,

			// Budget Step
			budget: budget,
			budgetType: budgetType,

			// Open Source Step
			openSource: openSource,
			openSourceProjectUrl: openSourceProjectUrl,

			// Setting Step
			color: color,
			taskListType: taskListType,
			public: isPublic,
			billable: billable,

			imageId
		});
	}

	selectedTagsEvent(selectedTags: ITag[]) {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}

	/**
	 * Add organization contact
	 *
	 * @param name
	 * @returns
	 */
	addNewOrganizationContact = async (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			const { id: organizationId, tenantId } = this.organization;

			const contact: IOrganizationContact = await this._organizationContactService.create({
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT
			});
			if (contact) {
				const { name } = contact;
				this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', {
					name
				});
			}
			return contact;
		} catch (error) {
			this._errorHandler.handleError(error);
		}
	};

	openTasksSettings(): void {
		this._router.navigate(['/pages/tasks/settings', this.project.id], {
			state: this.project
		});
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) { }

	/**
	 * Load employees from multiple selected employees
	 *
	 * @param employees
	 */
	public onLoadEmployees(employees: IEmployee[]) {
		this.employees = employees;
	}

	public get projectName(): AbstractControl {
		return this.form.get('name');
	}

	public get projectUrl(): AbstractControl {
		return this.form.get('projectUrl');
	}

	public get openSourceProjectUrl(): AbstractControl {
		return this.form.get('openSourceProjectUrl');
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
			const { id: projectId } = this.project;
			const integrationId = this.integration['id'];

			/** */
			const request: IIntegrationMapSyncRepository = {
				organizationId,
				tenantId,
				integrationId,
				repository
			}
			// Fetch entity settings by integration ID and handle the result as an observable
			this._githubService.syncGithubRepository(request).pipe(
				switchMap(({ id: repositoryId }: IOrganizationGithubRepository) => {
					return this._organizationProjectsService.updateProjectSetting(projectId, {
						organizationId,
						tenantId,
						repositoryId,
						...(!this.projectSettingForm.get('syncTag').value ? { syncTag: SYNC_TAG_GAUZY } : {}),
					});
				}),
				tap((response: any) => {
					if (response['status'] == HttpStatus.BAD_REQUEST) {
						throw new Error(`${response['message']}`);
					}
				}),
				tap(() => {
					this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.SYNC_REPOSITORY', {
						repository: repository.full_name,
						project: this.project.name
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
			).subscribe();
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
			const { id: projectId } = this.project;

			// Create a 'request' object of type 'IOrganizationProjectSetting'.
			// It contains 'organizationId', 'tenantId', and auto-sync settings taken from 'this.projectSettingForm.value'.
			const request: IOrganizationProjectSetting = {
				organizationId,
				tenantId,
				...this.projectSettingForm.value
			}

			// Call the 'updateProjectSetting' method of the '_organizationProjectsService'
			// to update project settings with 'projectId' and the 'request'
			this._organizationProjectsService.updateProjectSetting(projectId, request).pipe(
				tap((response: any) => {
					if (response['status'] == HttpStatus.BAD_REQUEST) {
						throw new Error(`${response['message']}`);
					}
				}),
				tap(() => {
					this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.AUTO_SYNC_SETTING', {
						project: this.project.name
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
			).subscribe();
		} catch (error) {
			this._errorHandler.handleError(error);
		}
	}
}
