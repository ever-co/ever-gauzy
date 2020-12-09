import {
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	IEmployee,
	IOrganizationProject,
	ITag,
	ContactType,
	IOrganization
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { Store } from '../../../@core/services/store.service';
import { LocationFormComponent } from '../../../@shared/forms/location';

@Component({
	selector: 'ga-contact-mutation',
	templateUrl: './contact-mutation.component.html',
	styleUrls: ['./contact-mutation.component.scss']
})
export class ContactMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: IEmployee[];
	@Input()
	organizationId: string;
	@Input()
	organizationContact?: any;
	@Input()
	projectsWithoutOrganizationContact: IOrganizationProject[];
	@Input() isGridEdit: boolean;
	@Input()
	contactType: string;
	@Input()
	organization: IOrganization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditOrganizationContact = new EventEmitter();

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	defaultSelectedType: any;
	form: FormGroup;
	members: string[];
	selectedEmployeeIds: string[];
	allProjects: IOrganizationProject[] = [];
	tags: ITag[] = [];
	selectedProject: Object[] = [];
	contactTypes: ContactType[] = Object.values(ContactType);
	hoverState: boolean;
	country: string;
	projects: IOrganizationProject[] = [];

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
			this.organizationContact
				? this.organizationContact.selectedproject
				: []
		);
		if (this.organizationContact) {
			this.selectedEmployeeIds = this.organizationContact.members.map(
				(member) => member.id
			);
		}
		this._getProjects();
		this.defaultSelectedType = this.contactType;
	}

	private async _getProjects() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.organizationId = organizationId;
		const { items } = await this.organizationProjectsService.getAll([], {
			organizationId,
			tenantId
		});
		items.forEach((i) => {
			this.selectedProject = [
				...this.selectedProject,
				{ name: i.name, projectId: i.id }
			];
		});
	}

	private _initializeForm() {
		if (!this.organizationId) {
			return;
		}
		this.form = this.fb.group({
			imageUrl: [
				this.organizationContact
					? this.organizationContact.imageUrl
					: 'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text'
			],
			tags: [
				this.organizationContact
					? (this.tags = this.organizationContact.tags)
					: ''
			],
			name: [
				this.organizationContact
					? this.isGridEdit
						? this.organizationContact.contact_name
						: this.organizationContact.name
					: '',
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
			projects: [
				this.organizationContact
					? (this.organizationContact.projects || []).map(
							(m) => m.projectId
					  )
					: []
			],
			contactType: [
				this.organizationContact
					? this.organizationContact.contactType
					: '',
				Validators.required
			],
			fax: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.fax
						: ''
					: ''
			],
			website: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.website
						: ''
					: ''
			],
			fiscalInformation: [
				this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.fiscalInformation
						: ''
					: ''
			],
			location: this.locationForm
		});

		this._setLocationForm();
	}

	private _setLocationForm() {
		if (!this.organizationContact) {
			return;
		}
		setTimeout(() => {
			const { contact } = this.organizationContact;
			if (contact) {
				const {
					country,
					city,
					postcode,
					address,
					address2,
					latitude,
					longitude
				} = contact;
				this.locationFormDirective.setValue({
					country,
					city,
					postcode,
					address,
					address2,
					loc: {
						type: 'Point',
						coordinates: [latitude, longitude]
					}
				});
			}
		}, 200);
	}

	handleImageUploadError(error) {
		this.toastrService.danger(error, 'Error');
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		try {
			const { tenantId } = this.store.user;
			const { organizationId } = this;
			return this.organizationProjectsService
				.create({
					name,
					organizationId,
					tenantId
				})
				.then((project) => {
					this.toastrService.primary(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
							{
								name: name
							}
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					return project;
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
			let contactType = this.form.value['contactType'].$ngOptionLabel;
			if (contactType === undefined) {
				contactType = this.defaultSelectedType;
			}
			let imgUrl = this.form.value.imageUrl;
			imgUrl = imgUrl
				? this.form.value['imageUrl']
				: 'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text';

			const { tenantId } = this.store.user;
			const { organizationId } = this;

			const location = this.locationFormDirective.getValue();
			const { coordinates } = location['loc'];
			delete location['loc'];

			const [latitude, longitude] = coordinates;
			const contact = {
				...{ organizationId, tenantId },
				...location,
				...{ latitude, longitude }
			};

			this.addOrEditOrganizationContact.emit({
				tags: this.tags,
				id: this.organizationContact
					? this.organizationContact.id
					: undefined,
				organizationId,
				tenantId,
				name: this.form.value['name'],
				primaryEmail: this.form.value['primaryEmail'],
				primaryPhone: this.form.value['primaryPhone'],
				projects: this.form.value['projects']
					? this.form.value['projects']
					: '',
				contactType: contactType,
				imageUrl: imgUrl,
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e),
				fax: this.form.value['fax'],
				fiscalInformation: this.form.value['fiscalInformation'],
				website: this.form.value['website'],
				...contact
			});

			this.selectedEmployeeIds = [];
			this.members = [];
			this.form.reset({
				name: '',
				primaryEmail: '',
				primaryPhone: '',
				country: '',
				city: '',
				address: '',
				address2: '',
				postcode: null,
				contactType: '',
				imgUrl: '',
				projects: [],
				fax: '',
				fiscalInformation: '',
				website: ''
			});
		}
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}
}
