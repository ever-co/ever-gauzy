import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	Employee,
	OrganizationContact,
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
	selector: 'ga-edit-organization-contact-mutation',
	templateUrl: './edit-organization-contact-mutation.component.html'
})
export class EditOrganizationContactMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organizationId: string;
	@Input()
	organizationContact?: OrganizationContact;
	@Input()
	projectsWithoutOrganizationContact: OrganizationProjects[];

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditOrganizationContact = new EventEmitter();

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
		this.allProjects = (
			this.projectsWithoutOrganizationContact || []
		).concat(
			this.organizationContact ? this.organizationContact.projects : []
		);
		if (this.organizationContact) {
			this.selectedEmployeeIds = this.organizationContact.members.map(
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
			tags: [
				this.organizationContact
					? (this.tags = this.organizationContact.tags)
					: ''
			],
			name: [
				this.organizationContact ? this.organizationContact.name : '',
				Validators.required
			],
			primaryEmail: [
				this.organizationContact
					? this.organizationContact.primaryEmail
					: '',
				[Validators.required, Validators.email]
			],
			primaryPhone: [
				this.organizationContact
					? this.organizationContact.primaryPhone
					: '',
				Validators.required
			],
			country: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.country
						: ''
					: ''
			],
			city: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.city
						: ''
					: ''
			],
			street: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.street
						: ''
					: ''
			],
			selectProjects: [
				this.organizationContact
					? (this.organizationContact.projects || []).map((m) => m.id)
					: []
			],
			contactType: [
				this.organizationContact ? this.organizationContact.contactType : '',
				Validators.required
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
			this.addOrEditOrganizationContact.emit({
				tags: this.tags,
				id: this.organizationContact
					? this.organizationContact.id
					: undefined,
				organizationId: this.organizationId,
				name: this.form.value['name'],
				primaryEmail: this.form.value['primaryEmail'],
				primaryPhone: this.form.value['primaryPhone'],
				country: this.form.value['country'],
				city: this.form.value['city'],
				street: this.form.value['street'],
				projects: this.form.value['selectProjects'].projectId,
				contactType: this.form.value['contactType'].$ngOptionLabel,
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
				contactType: '',
				selectProjects: []
			});
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
