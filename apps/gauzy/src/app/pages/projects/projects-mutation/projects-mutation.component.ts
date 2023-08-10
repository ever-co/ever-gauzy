import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IEmployee,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	ProjectBillingEnum,
	ITag,
	ProjectOwnerEnum,
	TaskListTypeEnum,
	ContactType,
	ICurrency,
	OrganizationProjectBudgetTypeEnum,
	IImageAsset
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { uniq } from 'underscore';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { distinctUntilChange } from '@gauzy/common-angular';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { patterns } from '../../../@shared/regex/regex-patterns.const';
import { environment as ENV } from './../../../../environments/environment';
import { ErrorHandlingService, OrganizationContactService, Store, ToastrService } from '../../../@core/services';
import { DUMMY_PROFILE_IMAGE } from '../../../@core/constants';
import { CompareDateValidator } from '../../../@core/validators';
import { FormHelpers } from '../../../@shared/forms/helpers';
import { ckEditorConfig } from "../../../@shared/ckeditor.config";

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-projects-mutation',
	templateUrl: './projects-mutation.component.html',
	styleUrls: ['./projects-mutation.component.scss']
})
export class ProjectsMutationComponent extends TranslationBaseComponent
	implements OnInit {

	FormHelpers: typeof FormHelpers = FormHelpers;
	OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	TaskListTypeEnum = TaskListTypeEnum;
	members: string[] = [];
	selectedEmployeeIds: string[] = [];
	billings: string[] = Object.values(ProjectBillingEnum);
	owners: ProjectOwnerEnum[] = Object.values(ProjectOwnerEnum);
	taskViewModeTypes: TaskListTypeEnum[] = Object.values(TaskListTypeEnum);
	showSprintManage = false;
	ckConfig: CKEditor4.Config = ckEditorConfig;
	public organization: IOrganization;
	employees: IEmployee[] = [];
	hoverState: boolean;

	/*
	* Project Mutation Form
	*/
	public form: FormGroup = ProjectsMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			imageUrl: [],
			imageId: [],
			tags: [],
			public: [],
			billable: [],
			name: ['', Validators.required],
			organizationContact: [],
			billing: [ProjectBillingEnum.RATE],
			currency: [ENV.DEFAULT_CURRENCY],
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
			projectUrl: [null, Validators.compose([
				Validators.pattern(new RegExp(patterns.websiteUrl))
			])
			],
			openSourceProjectUrl: [null, Validators.compose([
				Validators.pattern(new RegExp(patterns.websiteUrl))
			])
			]
		}, {
			validators: [
				CompareDateValidator.validateDate('startDate', 'endDate')
			]
		});
	}

	/*
	* Getter & Setter for dynamic project element
	*/
	private _project: IOrganizationProject;
	get project(): IOrganizationProject {
		return this._project;
	}
	@Input() set project(project: IOrganizationProject) {
		this._project = project;
	}

	@Input() organizationContacts: any[] = [];

	@Output() canceled = new EventEmitter();
	@Output() addOrEditProject = new EventEmitter();

	constructor(
		private readonly fb: FormBuilder,
		private readonly organizationContactService: OrganizationContactService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly router: Router,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._loadDefaultCurrency()),
				tap(() => this._syncProject()),
				tap(() => this._getOrganizationContacts()),
				untilDestroyed(this)
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
		const { currency = ENV.DEFAULT_CURRENCY } = this.organization;
		if (currency) {
			this.form.get('currency').setValue(currency);
			this.form.get('currency').updateValueAndValidity();
		}
	}

	private async _getOrganizationContacts() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.organizationContactService.getAll([], {
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
		});
		this.form.updateValueAndValidity();
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

	cancel() {
		this.canceled.emit();
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { name, code, projectUrl, owner, organizationContact, startDate, endDate } = this.form.value;
		const { description, tags } = this.form.value;
		const { billing, currency } = this.form.value;
		const { budget, budgetType } = this.form.value;
		const { openSource, openSourceProjectUrl } = this.form.value;
		const { color, taskListType, public: isPublic, billable } = this.form.value;
		const { imageId } = this.form.value;

		this.addOrEditProject.emit({
			action: !this.project ? 'add' : 'edit',
			project: {
				id: this.project ? this.project.id : undefined,

				// Main Step
				name: name,
				code: code,
				projectUrl: projectUrl,
				owner: owner,
				organizationContactId: organizationContact ? organizationContact.id : null,
				startDate: startDate,
				endDate: endDate,
				members: this.members.map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e),

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

				organizationId,
				tenantId,
				imageId
			}
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
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			const contact: IOrganizationContact = await this.organizationContactService.create({
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT
			});
			if (contact) {
				const { name } = contact;
				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', {
					name
				});
			}
			return contact;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	openTasksSettings(): void {
		this.router.navigate(['/pages/tasks/settings', this.project.id], {
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
		this.toastrService.danger(error);
	}
}
