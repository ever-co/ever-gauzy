import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	Employee,
	OrganizationClients,
	OrganizationProjects,
	Tag
} from '@gauzy/models';
import { OrganizationProjectsService } from '../../../../../../@core/services/organization-projects.service';
import { Store } from '../../../../../../@core/services/store.service';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../../../../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../../../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-organization-clients-mutation',
	templateUrl: './edit-organization-clients-mutation.component.html'
})
export class EditOrganizationClientMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organizationId: string;
	@Input()
	client?: OrganizationClients;
	@Input()
	projectsWithoutClients: OrganizationProjects[];

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditClient = new EventEmitter();

	form: FormGroup;
	members: string[];
	selectedEmployeeIds: string[];
	allProjects: OrganizationProjects[] = [];
	tags: Tag[] = [];
	projects: Object[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.allProjects = (this.projectsWithoutClients || []).concat(
			this.client ? this.client.projects : []
		);
		if (this.client) {
			this.selectedEmployeeIds = this.client.members.map(
				(member) => member.id
			);
		}
		this._getProjects();
	}

	private async _getProjects() {
		this.organizationId = this.store.selectedOrganization.id;
		const { items } = await this.organizationProjectsService.getAll([], {
			organizationId: this.store.selectedOrganization.id
		});
		items.forEach((i) => {
			this.projects = [
				...this.projects,
				{ name: i.name, projectId: i.id }
			];
		});
	}

	private _initializeForm() {
		if (!this.organizationId) {
			return;
		}

		this.form = this.fb.group({
			tags: [this.client ? (this.tags = this.client.tags) : ''],
			name: [this.client ? this.client.name : '', Validators.required],
			primaryEmail: [
				this.client ? this.client.primaryEmail : '',
				[Validators.required, Validators.email]
			],
			primaryPhone: [
				this.client ? this.client.primaryPhone : '',
				Validators.required
			],
			country: [this.client ? this.client.country : ''],
			city: [this.client ? this.client.city : ''],
			street: [this.client ? this.client.street : ''],
			selectProjects: [
				this.client ? (this.client.projects || []).map((m) => m.id) : []
			]
		});
	}

	addNewProject = (name: string): Promise<OrganizationProjects> => {
		try {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.organizationProjectsService.create({
				name,
				organizationId: this.organizationId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			this.addOrEditClient.emit({
				tags: this.tags,
				id: this.client ? this.client.id : undefined,
				organizationId: this.organizationId,
				name: this.form.value['name'],
				primaryEmail: this.form.value['primaryEmail'],
				primaryPhone: this.form.value['primaryPhone'],
				country: this.form.value['country'],
				city: this.form.value['city'],
				street: this.form.value['street'],
				projects: this.form.value['selectProjects'].projectId,
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e)
			});

			this.selectedEmployeeIds = [];
			this.members = [];
			this.form.reset({
				name: '',
				primaryEmail: '',
				primaryPhone: '',
				country: '',
				city: '',
				street: '',
				selectProjects: []
			});
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
