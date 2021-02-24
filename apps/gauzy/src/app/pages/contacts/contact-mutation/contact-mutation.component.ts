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
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { Store } from '../../../@core/services/store.service';
import { LocationFormComponent } from '../../../@shared/forms/location';
import { EmployeesService } from '../../../@core/services/employees.service';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { FilterArrayPipe } from '../../../@shared/pipes/filter-array.pipe';
import { LeafletMapComponent } from '../../../@shared/forms/maps/leaflet/leaflet.component';
import { LatLng } from 'leaflet';
import { ToastrService } from '../../../@core/services/toastr.service';
import { isEmpty } from '@gauzy/common-angular';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact-mutation',
	templateUrl: './contact-mutation.component.html',
	styleUrls: ['./contact-mutation.component.scss']
})
export class ContactMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input() organizationContact?: any;
	@Input() projectsWithoutOrganizationContact: IOrganizationProject[];
	@Input() isGridEdit: boolean;
	@Input() contactType: string;

	@Output()
	canceled = new EventEmitter();

	@Output()
	addOrEditOrganizationContact = new EventEmitter();

	@ViewChild('leafletTemplate', { static: false })
	leafletTemplate: LeafletMapComponent;

	@ViewChild('locationFormDirective')
	locationFormDirective: LocationFormComponent;

	@ViewChild('stepper') stepper: NbStepperComponent;

	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	contMainForm: FormGroup;
	defaultSelectedType: any;
	members: string[];
	selectedMembers: IEmployee[];
	selectedEmployeeIds: string[];
	allProjects: IOrganizationProject[] = [];
	tags: ITag[] = [];
	selectedProject: Object[] = [];
	contactTypes: ContactType[] = Object.values(ContactType);
	hoverState: boolean;
	country: string;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	organizationId: string;
	organization: IOrganization;

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly filterArrayPipe: FilterArrayPipe,
		private readonly employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		storeOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				tap((organization) => {
					this.organization = organization;
					this.organizationId = organization.id;
					this._initializeForm();
					this._getProjects();
					this._getEmployees();
				}),
				untilDestroyed(this)
			)
			.subscribe();

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
		this.defaultSelectedType = this.contactType;
	}

	private async _getEmployees() {
		const { tenantId } = this.store.user;
		const { organizationId } = this;
		const { items } = await this.employeesService
			.getAll(['user'], {
				organizationId,
				tenantId
			})
			.pipe(first())
			.toPromise();
		this.employees = items;
		if (this.organizationId) {
			this.selectedMembers = this.filterArrayPipe.transform(
				this.employees,
				this.selectedEmployeeIds
			);
		}
	}

	private async _getProjects() {
		const { tenantId } = this.store.user;
		const { organizationId } = this;
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

		this.contMainForm = this.fb.group({
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
				[Validators.email]
			],
			primaryPhone: [
				this.organizationContact
					? this.organizationContact.primaryPhone
					: ''
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
					: ''
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
			]
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
		this.toastrService.danger(error);
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
					this.toastrService.success(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
						{
							name: name
						}
					);
					return project;
				});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	onMembersSelected(members: string[]) {
		this.members = members;
		this.selectedMembers = this.filterArrayPipe.transform(
			this.employees,
			this.members
		);
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.contMainForm.valid) {
			let contactType = this.contMainForm.value['contactType']
				.$ngOptionLabel;
			if (isEmpty(contactType)) {
				contactType = this.defaultSelectedType;
			}
			let imgUrl = this.contMainForm.value.imageUrl;
			imgUrl = imgUrl
				? this.contMainForm.value['imageUrl']
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
				name: this.contMainForm.value['name'],
				primaryEmail: this.contMainForm.value['primaryEmail'],
				primaryPhone: this.contMainForm.value['primaryPhone'],
				projects: this.contMainForm.value['projects']
					? this.contMainForm.value['projects']
					: '',
				contactType: contactType,
				imageUrl: imgUrl,
				members: (this.members || this.selectedEmployeeIds || [])
					.map((id) => this.employees.find((e) => e.id === id))
					.filter((e) => !!e),
				fax: this.contMainForm.value['fax'],
				fiscalInformation: this.contMainForm.value['fiscalInformation'],
				website: this.contMainForm.value['website'],
				...contact
			});

			this.selectedEmployeeIds = [];
			this.members = [];
			this.contMainForm.reset({
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
		if (!this.contMainForm.contains(control)) {
			return true;
		}
		return (
			this.contMainForm.get(control).touched &&
			this.contMainForm.get(control).invalid
		);
	}

	nextStep() {
		this.stepper.next();
		if (this.stepper.selectedIndex === 1) {
			const {
				loc: { coordinates }
			} = this.locationFormDirective.getValue();
			const [lat, lng] = coordinates;
			setTimeout(() => {
				this.leafletTemplate.addMarker(new LatLng(lat, lng));
			}, 200);
		}
	}

	/*
	 * Google Place and Leaflet Map Coordinates Changed Event Emitter
	 */
	onCoordinatesChanges(
		$event: google.maps.LatLng | google.maps.LatLngLiteral
	) {
		const {
			loc: { coordinates }
		} = this.locationFormDirective.getValue();

		const [lat, lng] = coordinates;
		if (this.leafletTemplate) {
			this.leafletTemplate.addMarker(new LatLng(lat, lng));
		}
	}

	/*
	 * Leaflet Map Click Event Emitter
	 */
	onMapClicked(latlng: LatLng) {
		const { lat, lng }: LatLng = latlng;
		const location = this.locationFormDirective.getValue();
		this.locationFormDirective.setValue({
			...location,
			country: '',
			loc: {
				type: 'Point',
				coordinates: [lat, lng]
			}
		});
		this.locationFormDirective.onCoordinatesChanged();
	}

	/*
	 * Google Place Geometry Changed Event Emitter
	 */
	onGeometrySend(geometry: any) {}
}
