import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import {
	IEmployee,
	IOrganizationProject,
	ITag,
	ContactType,
	IOrganization,
	OrganizationContactBudgetTypeEnum,
	IOrganizationContact,
	IImageAsset,
	IOrganizationProjectEmployee,
	ID
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { LatLng } from 'leaflet';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FilterArrayPipe, FormHelpers, LeafletMapComponent, LocationFormComponent } from '@gauzy/ui-core/shared';
import { ErrorHandlingService, OrganizationProjectsService, Store, ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact-mutation',
	templateUrl: './contact-mutation.component.html',
	styleUrls: ['./contact-mutation.component.scss']
})
export class ContactMutationComponent extends TranslationBaseComponent implements OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;

	/**
	 * Getter and Setter for organizationContact.
	 * When a new organizationContact is set, synchronizes organization contact members.
	 */
	private _organizationContact: IOrganizationContact;
	get organizationContact(): IOrganizationContact {
		return this._organizationContact;
	}
	@Input() set organizationContact(value: IOrganizationContact) {
		this._organizationContact = value;
		if (value) {
			this.syncOrganizationContactMembers();
		}
	}

	/*
	 * Getter & Setter for projectsWithoutOrganizationContacts element
	 */
	private _projectsWithoutOrganizationContacts: IOrganizationProject[];
	get projectsWithoutOrganizationContacts(): IOrganizationProject[] {
		return this._projectsWithoutOrganizationContacts;
	}
	@Input() set projectsWithoutOrganizationContacts(value: IOrganizationProject[]) {
		this._projectsWithoutOrganizationContacts = value;
	}

	/*
	 * Getter & Setter for contactType element
	 */
	private _contactType: ContactType;
	get contactType(): ContactType {
		return this._contactType;
	}
	@Input() set contactType(value: ContactType) {
		this._contactType = value;
	}

	/*
	 * Output event emitter for cancel process event
	 */
	@Output() canceled = new EventEmitter();

	/*
	 * Output event emitter for add/edit organization contact event
	 */
	@Output() addOrEditOrganizationContact = new EventEmitter();

	// leaflet map template
	@ViewChild('leafletTemplate', { static: false }) leafletTemplate: LeafletMapComponent;

	// leaflet location form directive
	@ViewChild('locationFormDirective') locationFormDirective: LocationFormComponent;

	// form stepper
	@ViewChild('stepper') stepper: NbStepperComponent;

	members: string[] = [];
	selectedMembers: IEmployee[] = [];
	selectedEmployeeIds: string[];
	contactTypes: string[] = Object.values(ContactType);
	hoverState: boolean;
	country: string;
	projects: IOrganizationProject[] = [];
	employees: IEmployee[] = [];
	organization: IOrganization;
	organizationContactBudgetTypeEnum = OrganizationContactBudgetTypeEnum;

	/**
	 * Main Content Stepper Form Group
	 */
	public contMainForm: UntypedFormGroup = ContactMutationComponent.buildMainForm(this.fb);
	static buildMainForm(formBuilder: UntypedFormBuilder): UntypedFormGroup {
		const form = formBuilder.group({
			imageId: [null],
			imageUrl: [null],
			tags: [],
			name: ['', [Validators.required]],
			primaryEmail: [null, [Validators.email]],
			primaryPhone: [null],
			projects: [],
			contactType: [],
			fax: [null],
			website: [null],
			fiscalInformation: [null]
		});
		return form;
	}

	/**
	 * Location Stepper Form Group
	 */
	readonly locationForm: UntypedFormGroup = LocationFormComponent.buildForm(this.fb);

	/**
	 * Budget Stepper Form Group
	 */
	readonly budgetForm: UntypedFormGroup = ContactMutationComponent.buildBudgetForm(this.fb);
	static buildBudgetForm(formBuilder: UntypedFormBuilder): UntypedFormGroup {
		const form = formBuilder.group({
			budget: [],
			budgetType: []
		});
		return form;
	}

	/*
	 * Getter form control value for budgetType
	 */
	get budgetType(): string {
		return this.budgetForm.get('budgetType').value;
	}

	/*
	 * Getter form control value for budgetType
	 */
	get tags(): ITag[] {
		return this.contMainForm.get('tags').value;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly filterArrayPipe: FilterArrayPipe
	) {
		super(translateService);
	}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		storeOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._patchForm()),
				tap(() => this._getProjects()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sync organization contact members.
	 * Updates `selectedEmployeeIds` based on the members of the organization contact.
	 */
	syncOrganizationContactMembers() {
		this.selectedEmployeeIds = this.organizationContact?.members?.map((member: IEmployee) => member.id) ?? [];
	}

	/**
	 * Load employees from multiple selected employees
	 *
	 * @param employees
	 */
	public onLoadEmployees(employees: IEmployee[]) {
		this.employees = employees;
		this.selectedMembers = this.filterArrayPipe.transform(this.employees, this.selectedEmployeeIds);
	}

	/**
	 * Fetches all projects associated with the current organization and user tenant, and updates the 'projects' property.
	 */
	private async _getProjects() {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const { items } = await this.organizationProjectsService.getAll([], {
				organizationId,
				tenantId
			});

			this.projects = items;
		} catch (error) {
			console.error('Error fetching projects:', error);
		}
	}

	private _patchForm() {
		if (!this.organization) {
			return;
		}
		const orgContact = this.organizationContact;
		//
		this.contMainForm.patchValue({
			imageId: orgContact?.imageId ?? null,
			imageUrl: orgContact?.imageUrl ?? null,
			tags: orgContact?.tags ?? [],
			name: orgContact?.name ?? null,
			primaryEmail: orgContact?.primaryEmail ?? null,
			primaryPhone: orgContact?.primaryPhone ?? null,
			projects: orgContact?.projects ?? [],
			contactType: orgContact?.contactType ?? this.contactType,
			fax: orgContact?.contact?.fax ?? null,
			website: orgContact?.contact?.website ?? null,
			fiscalInformation: orgContact?.contact?.fiscalInformation ?? null
		});
		this.contMainForm.updateValueAndValidity();

		//
		this.budgetForm.patchValue({
			budgetType: orgContact?.budgetType ?? OrganizationContactBudgetTypeEnum.HOURS,
			budget: orgContact?.budget ?? null
		});
		this.budgetForm.updateValueAndValidity();

		this._setLocationForm();
	}

	/**
	 *
	 * @returns
	 */
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
		this.errorHandler.handleError(error);
	}
	/**
	 * Upload employee image/avatar
	 *
	 * @param image
	 */
	async updateImageAsset(image: IImageAsset) {
		if (image) {
			this.contMainForm.get('imageId').setValue(image.id);
			this.contMainForm.get('imageUrl').setValue(image.fullUrl);
		}
		this.contMainForm.updateValueAndValidity();
	}

	/**
	 * Add a new project.
	 *
	 * @param name Name of the project
	 * @returns A Promise resolving to the newly created IOrganizationProject
	 */
	addNewProject = async (name: string): Promise<IOrganizationProject> => {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const project = await this.organizationProjectsService.create({
				name,
				organizationId,
				tenantId,
				members: []
			});

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', { name });

			return project;
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	onMembersSelected(members: string[]) {
		this.members = members;
		this.selectedMembers = this.filterArrayPipe.transform(this.employees, this.members);
	}

	cancel() {
		this.canceled.emit();
	}

	/**
	 * Submits and processes form data for organizational contacts.
	 * Validates main form, consolidates data from multiple forms, processes members and project info,
	 * and emits the combined data for further action.
	 */
	async submitForm() {
		if (this.contMainForm.invalid) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const data = this.contMainForm.value;
		const budget = this.budgetForm.value;
		const locationData = this.locationFormDirective.getValue();
		const { fax, fiscalInformation, website } = this.contMainForm.value;

		// Extract and destructure coordinates
		const { coordinates, ...location } = locationData.loc;
		const [latitude, longitude] = coordinates;

		// Construct the contact object
		const contact = {
			latitude,
			longitude,
			fiscalInformation,
			website,
			fax,
			...location,
			organizationId,
			organization: { id: organizationId },
			tenantId,
			tenant: { id: tenantId },
			...(this.organizationContact?.contact?.id && { id: this.organizationContact.contact.id })
		};

		// Consolidate member IDs and retrieve corresponding employees
		const members = this.getSelectedMembers();

		// Retrieve and process projects with assigned members
		const projects = this.assignMembersToProjects(data.projects ?? [], members);

		// Step 5: Emit the consolidated data
		this.emitConsolidatedData({ budget, data, projects, members, contact });
	}

	/**
	 * Retrieves selected members based on member IDs or selected employees.
	 * @returns An array of IEmployee objects.
	 */
	private getSelectedMembers(): IEmployee[] {
		// Step 1: Get the list of member IDs
		const memberIds = this.members || this.selectedEmployeeIds || [];

		// Step 2: Find corresponding IEmployee objects and filter out any falsy values
		const members = memberIds.map((id) => this.employees.find((e) => e.id === id)).filter(Boolean);

		// Fallback to selectedMembers if no members found
		return members.length ? members : this.selectedMembers;
	}

	/**
	 * Assigns selected members to each project by transforming them into IOrganizationProjectEmployee objects.
	 * @param projects The array of projects to which members will be assigned.
	 * @param members The array of selected IEmployee objects.
	 * @returns The updated array of projects with assigned members.
	 */
	private assignMembersToProjects(projects: IOrganizationProject[], members: IEmployee[]): IOrganizationProject[] {
		return projects.map((project: IOrganizationProject) => {
			// Get the project members and transform them into IOrganizationProjectEmployee objects
			const projectMembers: IOrganizationProjectEmployee[] = members.map((employee: IEmployee) =>
				this.transformToProjectEmployee(employee, project, this.organization)
			);

			return {
				...project,
				members: Array.isArray(project.members) ? [...project.members, ...projectMembers] : [...projectMembers]
			};
		});
	}

	/**
	 * Emits the consolidated data for further processing.
	 *
	 * @param payload The data to be emitted.
	 */
	private emitConsolidatedData(payload: {
		budget: any;
		data: any;
		projects: IOrganizationProject[];
		members: IEmployee[];
		contact: any;
	}) {
		const { budget, data, projects, members, contact } = payload;
		const { id: organizationId, tenantId } = this.organization;

		// Emit the consolidated data
		this.addOrEditOrganizationContact.emit({
			...budget,
			...data,
			projects,
			members,
			contact,
			organizationId,
			organization: { id: organizationId },
			tenantId,
			tenant: { id: tenantId },
			...(this.organizationContact?.id && { id: this.organizationContact.id })
		});
	}

	/**
	 * Transforms an IEmployee into an IOrganizationProjectEmployee.
	 *
	 * @param employee The employee to transform.
	 * @param project The project to associate with the employee.
	 * @param organization The organization context.
	 * @returns The transformed IOrganizationProjectEmployee object.
	 */
	private transformToProjectEmployee = (
		employee: IEmployee,
		project: IOrganizationProject,
		organization: IOrganization
	): IOrganizationProjectEmployee => ({
		...employee,
		organizationProject: project, // Assign the current project
		organizationProjectId: project.id, // Assign the project's ID
		organizationId: organization.id, // Assign the organization's ID
		tenantId: organization.tenantId // Assign the organization's tenant ID
	});

	/**
	 * Updates the 'tags' field in 'contMainForm' with the selected tags and validate the form.
	 * @param tags An array of selected tag objects.
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.contMainForm.patchValue({ tags });
		this.contMainForm.updateValueAndValidity();
	}

	/**
	 * Progresses the stepper and adds a map marker on the second step.
	 */
	nextStep() {
		this.stepper.next();

		// Assuming the second step is related to map operations.
		if (this.stepper.selectedIndex === 1) {
			// Directly destructure 'coordinates' from the location form value.
			const {
				loc: {
					coordinates: [lat, lng]
				}
			} = this.locationFormDirective.getValue();

			// Delay marker addition to ensure the map is ready. Adjust delay as needed.
			setTimeout(() => {
				this.leafletTemplate.addMarker(new LatLng(lat, lng));
			}, 200);
		}
	}

	/*
	 * Google Place and Leaflet Map Coordinates Changed Event Emitter
	 */
	onCoordinatesChanges($event: google.maps.LatLng | google.maps.LatLngLiteral) {
		const {
			loc: { coordinates }
		} = this.locationFormDirective.getValue();

		const [lat, lng] = coordinates;
		if (this.leafletTemplate) {
			this.leafletTemplate.addMarker(new LatLng(lat, lng));
		}
	}

	/**
	 * Handles click events on the Leaflet map. Updates the location form with the clicked coordinates
	 * and resets some location-related fields. It also triggers a recalculation of dependent form values.
	 *
	 * @param latlng The latitude and longitude object from the map click event.
	 */
	onMapClicked(latlng: LatLng) {
		const location = this.locationFormDirective.getValue();

		this.locationFormDirective.setValue({
			...location,
			country: '',
			loc: {
				type: 'Point',
				coordinates: [latlng.lat, latlng.lng]
			}
		});

		this.locationFormDirective.onCoordinatesChanged();
	}

	/*
	 * Google Place Geometry Changed Event Emitter
	 */
	onGeometrySend(geometry: any) {}
}
