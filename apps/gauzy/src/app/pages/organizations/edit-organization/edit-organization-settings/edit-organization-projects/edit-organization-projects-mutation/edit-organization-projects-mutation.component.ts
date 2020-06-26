import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
	CurrenciesEnum,
	Employee,
	Organization,
	OrganizationClients,
	OrganizationProjects,
	ProjectTypeEnum,
	Tag
} from '@gauzy/models';
import { OrganizationClientsService } from '../../../../../../@core/services/organization-clients.service ';
import { Store } from '../../../../../../@core/services/store.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService } from '../../../../../../@core/services/error-handling.service';

@Component({
	selector: 'ga-edit-organization-projects-mutation',
	templateUrl: './edit-organization-projects-mutation.component.html'
})
export class EditOrganizationProjectsMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organization: Organization;
	@Input()
	project: OrganizationProjects;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditProject = new EventEmitter();

	form: FormGroup;
	members: string[];
	selectedEmployeeIds: string[];
	types: string[] = Object.values(ProjectTypeEnum);
	currencies: string[] = Object.values(CurrenciesEnum);
	defaultCurrency: string;
	public: Boolean = true;
	tags: Tag[] = [];
	organizationId: string;
	clients: Object[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._getClients();
	}

	private async _getClients() {
		this.organizationId = this.store.selectedOrganization.id;
		const { items } = await this.organizationClientsService.getAll([], {
			organizationId: this.store.selectedOrganization.id
		});
		items.forEach((i) => {
			this.clients = [
				...this.clients,
				{ name: i.name, clientId: i.id }
			];
		});
	}

	private _initializeForm() {
		if (!this.organization) {
			return;
		}

		if (this.project) {
			this.selectedEmployeeIds = this.project.members.map(
				(member) => member.id
			);
		}

		this.defaultCurrency = this.organization.currency || 'USD';

		this.form = this.fb.group({
			tags: [this.project ? (this.tags = this.project.tags) : ''],
			public: this.project ? this.project.public : this.public,
			name: [this.project ? this.project.name : ''],
			client: [
				this.project && this.project.client
					? this.project.client.id
					: ''
			],
			type: [this.project ? this.project.type : 'RATE'],
			currency: [
				{
					value: this.project
						? this.project.currency
						: this.defaultCurrency,
					disabled: true
				}
			],
			startDate: [this.project ? this.project.startDate : null],
			endDate: [this.project ? this.project.endDate : null]
		});
	}

	togglePublic(state: boolean) {
		this.public = state;
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			this.addOrEditProject.emit({
				tags: this.tags,
				public: this.form.value['public'],
				id: this.project ? this.project.id : undefined,
				organizationId: this.organization.id,
				name: this.form.value['name'],
				client: this.form.value['client'].clientId,
				type: this.form.value['type'],
				currency: this.form.value['currency'] || this.defaultCurrency,
				startDate: this.form.value['startDate'],
				endDate: this.form.value['endDate'],
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e)
			});

			this.selectedEmployeeIds = [];
			this.members = [];
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	addNewClient = (name: string): Promise<OrganizationClients> => {
		try {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CLIENTS.ADD_CLIENT',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.organizationClientsService.create({
				name,
				organizationId: this.organizationId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};
}
