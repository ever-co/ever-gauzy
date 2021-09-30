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
	IOrganization,
	OrganizationContactBudgetTypeEnum
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { LatLng } from 'leaflet';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { LocationFormComponent } from '../../../@shared/forms/location';
import { FilterArrayPipe } from '../../../@shared/pipes/filter-array.pipe';
import { LeafletMapComponent } from '../../../@shared/forms/maps/leaflet/leaflet.component';
import { EmployeesService, ErrorHandlingService, OrganizationProjectsService, Store, ToastrService } from '../../../@core/services';
import { DUMMY_PROFILE_IMAGE } from '../../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact-mutation',
	templateUrl: './contact-mutation.component.html',
	styleUrls: ['./contact-mutation.component.scss']
})
export class ContactMutationComponent
	extends TranslationBaseComponent
	implements OnInit {

	/*
	* Getter & Setter for organizationContact element
	*/
	private _organizationContact: any;
	get organizationContact(): any {
		return this._organizationContact;
	}
	@Input() set organizationContact(value: any) {
		this._organizationContact = value;
	}

	/*
	* Getter & Setter for projectsWithoutOrganizationContact element
	*/
	private _projectsWithoutOrganizationContact: IOrganizationProject[];
	get projectsWithoutOrganizationContact(): IOrganizationProject[] {
		return this._projectsWithoutOrganizationContact;
	}
	@Input() set projectsWithoutOrganizationContact(value: IOrganizationProject[]) {
		this._projectsWithoutOrganizationContact = value;
	}

	/*
	* Getter & Setter for isGridEdit element
	*/
	private _isGridEdit: boolean;
	get isGridEdit(): boolean {
		return this._isGridEdit;
	}
	@Input() set isGridEdit(value: boolean) {
		this._isGridEdit = value;
	}

	/*
	* Getter & Setter for contactType element
	*/
	private _contactType: string;
	get contactType(): string {
		return this._contactType;
	}
	@Input() set contactType(value: string) {
		this._contactType = value;
	}

	/*
	* Output event emitter for cancel process event
	*/
	@Output()
	canceled = new EventEmitter();

	/*
	* Output event emitter for add/edit organization contact event 
	*/
	@Output()
	addOrEditOrganizationContact = new EventEmitter();

	// leaflet map template
	@ViewChild('leafletTemplate', { static: false }) leafletTemplate: LeafletMapComponent;

	// leaflet location form directive
	@ViewChild('locationFormDirective') locationFormDirective: LocationFormComponent;

	// form stepper
	@ViewChild('stepper') stepper: NbStepperComponent;


	members: string[];
	selectedMembers: IEmployee[];
	selectedEmployeeIds: string[];
	contactTypes: ContactType[] = Object.values(ContactType);
	hoverState: boolean;
	country: string;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	organization: IOrganization;

	organizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;

	/**
	* Main Content Stepper Form Group 
	*/
	public contMainForm: FormGroup = ContactMutationComponent.buildMainForm(this.fb);
	static buildMainForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			imageUrl: [],
			tags: [],
			name: ['', [Validators.required]],
			primaryEmail: ['', [Validators.email]],
			primaryPhone: [],
			projects: [],
			contactType: [],
			fax: [],
			website: [],
			fiscalInformation: []
		});
		return form;
	}

	/**
	* Location Stepper Form Group 
	*/
	readonly locationForm: FormGroup = LocationFormComponent.buildForm(this.fb);

	/**
	* Budget Stepper Form Group 
	*/
	readonly budgetForm: FormGroup = ContactMutationComponent.buildBudgetForm(this.fb);
	static buildBudgetForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			budget: [],
			budgetType: []
		});
		return form;
	}

	/*
	* Getter form control value for budgetType
	*/
	get budgetType (): string {
		return this.budgetForm.get('budgetType').value;
	}

	/*
	* Getter form control value for budgetType
	*/
	get tags (): ITag[] {
		return this.contMainForm.get('tags').value;
	}

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
				debounceTime(200),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._patchForm()),
				tap(() => this._getProjects()),
				tap(() => this._getEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
		if (this.organizationContact) {
			this.selectedEmployeeIds = this.organizationContact.members.map(
				(member) => member.id
			);
		}
	}

	private async _getEmployees() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.employeesService
			.getAll(['user'], {
				organizationId,
				tenantId
			})
			.pipe(first())
			.toPromise();
		this.employees = items;
		if (organizationId) {
			this.selectedMembers = this.filterArrayPipe.transform(
				this.employees,
				this.selectedEmployeeIds
			);
		}
	}

	private async _getProjects() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.organizationProjectsService.getAll([], {
			organizationId,
			tenantId
		});
		this.projects = items;
	}

	private _patchForm() {
		if (!this.organization) {
			return;
		}
		this.contMainForm.patchValue({
			imageUrl: this.organizationContact
						? this.organizationContact.imageUrl
						: DUMMY_PROFILE_IMAGE,
			tags: this.organizationContact
					? (this.organizationContact.tags)
					: [],
			name: this.organizationContact
						? this.isGridEdit
							? this.organizationContact.contact_name
							: this.organizationContact.name
						: '',
			primaryEmail: this.organizationContact
								? this.organizationContact.primaryEmail
								: '',
			primaryPhone: this.organizationContact
								? this.organizationContact.primaryPhone
								: '',
			projects: this.organizationContact
							? this.organizationContact.projects || []
							: [],
			contactType: this.organizationContact
							? this.organizationContact.contactType
							: this.contactType,
			fax: this.organizationContact
					? this.organizationContact.contact
						? this.organizationContact.contact.fax
						: ''
					: '',
			website: this.organizationContact
						? this.organizationContact.contact
							? this.organizationContact.contact.website
							: ''
						: '',
			fiscalInformation: this.organizationContact
									? this.organizationContact.contact
										? this.organizationContact.contact.fiscalInformation
										: ''
									: ''
		});
		this.contMainForm.updateValueAndValidity();

		this.budgetForm.patchValue({
			budgetType: this.organizationContact
							? this.organizationContact.budgetType
							: OrganizationContactBudgetTypeEnum.HOURS,
			budget: this.organizationContact 
						? this.organizationContact.budget
						: null
		});
		this.budgetForm.updateValueAndValidity();

		this._setLocationForm();
	}

	private _setLocationForm() {
		if (!this.organizationContact) {
			return;
		}
		setTimeout(() => {
			const { contact } = this.organizationContact;
			if (contact) {
				const { country, city, postcode, address, address2, latitude, longitude } = contact;
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
			const { id: organizationId } = this.organization;
			return this.organizationProjectsService
				.create({
					name,
					organizationId,
					tenantId
				})
				.then((project) => {
					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', {
						name 
					});
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
		if (this.contMainForm.invalid) {
			return;
		}
		const { fiscalInformation, website, contactType } = this.contMainForm.getRawValue();

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { budget, budgetType } = this.budgetForm.getRawValue();
		const { name, primaryEmail, primaryPhone, projects = [], fax, tags = [] } = this.contMainForm.getRawValue();

		let { imageUrl } = this.contMainForm.getRawValue();
		if (imageUrl === DUMMY_PROFILE_IMAGE) {
			imageUrl = null;
		}

		const location = this.locationFormDirective.getValue();
		const { coordinates } = location['loc'];
		delete location['loc'];

		const [latitude, longitude] = coordinates;
		const contact = {
			...{ organizationId, tenantId },
			...location,
			...{ latitude, longitude }
		};

		const members = (this.members || this.selectedEmployeeIds || [])
						.map((id) => this.employees.find((e) => e.id === id))
						.filter((e) => !!e);

		this.addOrEditOrganizationContact.emit({
			id: this.organizationContact
				? this.organizationContact.id
				: undefined,
			organizationId,
			tenantId,
			budgetType,
			budget,
			name,
			primaryEmail,
			primaryPhone,
			projects,
			contactType,
			imageUrl,
			members,
			tags,
			fax,
			fiscalInformation,
			website,
			...contact
		});
	}

	selectedTagsEvent(tags: ITag[]) {
		this.contMainForm.patchValue({ tags });
		this.contMainForm.updateValueAndValidity();
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
