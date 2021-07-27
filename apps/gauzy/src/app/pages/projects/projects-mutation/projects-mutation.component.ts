import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
	OrganizationProjectBudgetTypeEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { patterns } from '../../../@shared/regex/regex-patterns.const';
import { environment as ENV } from 'apps/gauzy/src/environments/environment';
import { ToastrService } from '../../../@core/services/toastr.service';
import { uniq } from 'underscore';

@Component({
	selector: 'ga-projects-mutation',
	templateUrl: './projects-mutation.component.html',
	styleUrls: ['./projects-mutation.component.scss']
})
export class ProjectsMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: IEmployee[];
	@Input()
	organization: IOrganization;
	@Input()
	project: IOrganizationProject;
	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditProject = new EventEmitter();
	@Input()
	organizationContacts: Object[] = [];
	OrganizationProjectBudgetTypeEnum = OrganizationProjectBudgetTypeEnum;
	TaskListTypeEnum = TaskListTypeEnum;
	form: FormGroup;
	members: string[] = [];
	selectedEmployeeIds: string[] = [];
	billings: string[] = Object.values(ProjectBillingEnum);
	defaultCurrency: string;
	public: Boolean = true;
	billable: Boolean = true;
	billingFlat: Boolean;
	tags: ITag[] = [];
	organizationId: string;
	owners: string[] = Object.values(ProjectOwnerEnum);
	taskViewModeTypes: TaskListTypeEnum[] = Object.values(TaskListTypeEnum);
	showSprintManage = false;
	openSource: boolean;
	public ckConfig: any = {
		width: '100%',
		height: '320'
	};

	constructor(
		private readonly fb: FormBuilder,
		private readonly organizationContactService: OrganizationContactService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private readonly router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._getOrganizationContacts();
	}

	private async _getOrganizationContacts() {
		const { id: organizationId, tenantId } = this.organization;
		this.organizationId = organizationId;
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
		if (owner === ProjectOwnerEnum.INTERNAL) {
			clientControl.setValue('');
		}
	}

	private _initializeForm() {
		if (!this.organization) {
			return;
		}

		if (this.project) {
			this.openSource = this.project.openSource;
			this.selectedEmployeeIds = this.project.members.map(
				(member) => member.id
			);
		}

		this.defaultCurrency =
			this.organization.currency || ENV.DEFAULT_CURRENCY;
		this.form = this.fb.group({
			tags: [this.project ? (this.tags = this.project.tags) : null],
			public: [this.project ? this.project.public : this.public],
			billable: [this.project ? this.project.billable : this.billable],
			name: [this.project ? this.project.name : null, Validators.required],
			organizationContact: [
				this.project && this.project.organizationContact
					? this.project.organizationContact
					: null
			],
			billing: [this.project ? this.project.billing : ProjectBillingEnum.RATE],
			currency: [
				this.project ? this.project.currency : this.defaultCurrency
			],
			startDate: [
				this.project ? new Date(this.project.startDate) : new Date()
			],
			endDate: [this.project ? this.project.endDate : null],
			owner: [this.project ? this.project.owner : ProjectOwnerEnum.CLIENT],
			taskViewMode: [this.project ? this.project.taskListType : TaskListTypeEnum.GRID],
			description: [this.project ? this.project.description : null],
			code: [this.project ? this.project.code : null],
			color: [this.project ? this.project.color : null],
			budget: [this.project ? this.project.budget : null],
			budgetType: [
				this.project
					? this.project.budgetType
					: OrganizationProjectBudgetTypeEnum.HOURS
			],
			openSource: [this.project ? this.project.openSource : null],
			projectUrl: [
				this.project ? this.project.projectUrl : null,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			openSourceProjectUrl: [
				this.project ? this.project.openSourceProjectUrl : null,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			]
		});
	}

	togglePublic(state: boolean) {
		this.public = state;
	}

	toggleBillable(state: boolean) {
		this.billable = state;
	}

	toggleOpenSource(state: boolean) {
		this.openSource = state;
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			const { organizationContact } = this.form.value;
			this.addOrEditProject.emit({
				action: !this.project ? 'add' : 'edit',
				project: {
					tags: this.tags,
					public: this.form.value['public'],
					billable: this.form.value['billable'],
					id: this.project ? this.project.id : undefined,
					organizationId: this.organization.id,
					name: this.form.value['name'],
					organizationContactId: organizationContact ? organizationContact.id : null,
					billing: this.form.value['billing'],
					budget: this.form.value.budget,
					budgetType: this.form.value.budgetType,
					currency:
						this.form.value['currency'] || this.defaultCurrency,
					startDate: this.form.value['startDate'],
					endDate: this.form.value['endDate'],
					owner: this.form.value['owner'],
					taskListType: this.form.value['taskViewMode'],
					members: (this.members || this.selectedEmployeeIds || [])
						.map((id) => this.employees.find((e) => e.id === id))
						.filter((e) => !!e),
					description: this.form.value['description'],
					billingFlat:
						this.form.value['billing'] === ProjectBillingEnum.RATE ||
							this.form.value['billing'] === ProjectBillingEnum.FLAT_FEE
							? true
							: false,
					code: this.form.value['code'],
					color: this.form.value['color'],
					openSource: this.form.value['openSource'],
					projectUrl: this.form.value['projectUrl'],
					openSourceProjectUrl: this.form.value[
						'openSourceProjectUrl'
					]
				}
			});
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	addNewOrganizationContact = (
		name: string
	): Promise<IOrganizationContact> => {
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT',
				{
					name: name
				}
			);
			return this.organizationContactService.create({
				name,
				organizationId: this.organizationId,
				contactType: ContactType.CLIENT,
				imageUrl:
					'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text'
			});
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

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
