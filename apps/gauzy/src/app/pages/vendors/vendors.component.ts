import { Component, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Cell } from 'angular2-smart-table';
import { ErrorHandlingService, OrganizationVendorsService, ServerDataSource, ToastrService } from '@gauzy/ui-core/core';
import { IOrganizationVendor, ITag, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	CompanyLogoComponent,
	DeleteConfirmationComponent,
	EmailComponent,
	ExternalLinkComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	TagsOnlyComponent
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-vendors',
	templateUrl: './vendors.component.html',
	styleUrls: ['vendors.component.scss']
})
export class VendorsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public addEditDialogRef: NbDialogRef<any>;
	public organization: IOrganization;
	public vendors: IOrganizationVendor[] = [];
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public selectedVendor: IOrganizationVendor;
	public tags: ITag[] = [];
	public settingsSmartTable: object;
	public smartTableSource: ServerDataSource;
	public selected = {
		vendor: null,
		state: false
	};
	public disabled: boolean = true;
	public saveDisabled: boolean = false;
	public loading: boolean = false;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Vendor Mutation Form
	 */
	public form: UntypedFormGroup = VendorsComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [null, Validators.required],
			phone: [null],
			email: [null, [Validators.required, Validators.email]],
			website: [null],
			tags: [null]
		});
	}

	@ViewChild('addEditTemplate') public addEditTemplateRef: TemplateRef<any>;

	constructor(
		private readonly organizationVendorsService: OrganizationVendorsService,
		private readonly toastrService: ToastrService,
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly store: Store,
		private readonly route: ActivatedRoute,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		// Subscribe to the subject$ observable
		this.subject$
			.pipe(
				// Execute the getVendors method when there's a new emission
				tap(() => this.getVendors()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the pagination$ observable
		this.pagination$
			.pipe(
				// Ensure distinct consecutive values to avoid redundant processing
				distinctUntilChange(),
				// Trigger the subject$ observable with a new value when pagination changes
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the selectedOrganization$ observable
		this.store.selectedOrganization$
			.pipe(
				// Filter out falsy values, ensuring only truthy organizations are processed
				filter((organization: IOrganization) => !!organization),
				// Extract the organization and assign it to the component property
				tap((organization: IOrganization) => (this.organization = organization)),
				// Trigger the _refresh$ observable with a new value
				tap(() => this._refresh$.next(true)),
				// Trigger the subject$ observable with a new value
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the query parameters
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.openDialog(this.addEditTemplateRef, false)),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the _refresh$ observable
		this._refresh$
			.pipe(
				// Execute the refreshPagination method
				tap(() => this.refreshPagination()),
				// Set the vendors array to an empty array
				tap(() => (this.vendors = [])),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Set up the view for the VENDORS component.
	 */
	setView() {
		// Set the current view component name to VENDORS
		this.viewComponentName = ComponentEnum.VENDORS;

		// Subscribe to changes in the component layout
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				// Ensure distinct consecutive values to avoid redundant processing
				distinctUntilChange(),
				// Set the dataLayoutStyle property based on the componentLayout
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				// Trigger the _refresh$ observable with a new value
				tap(() => this._refresh$.next(true)),
				// Trigger the subject$ observable with a new value
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				perPage: pagination ? pagination : this.minItemPerPage
			},
			columns: {
				logo: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.IMAGE'),
					type: 'custom',
					renderComponent: CompanyLogoComponent,
					componentInitFunction: (instance: CompanyLogoComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'string'
				},
				phone: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.PHONE'),
					type: 'string'
				},
				email: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EMAIL'),
					type: 'custom',
					renderComponent: EmailComponent,
					componentInitFunction: (instance: EmailComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				website: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.WEBSITE'),
					type: 'custom',
					class: 'align-row',
					renderComponent: ExternalLinkComponent,
					componentInitFunction: (instance: ExternalLinkComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					class: 'align-row',
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	edit(vendor: IOrganizationVendor) {
		this.tags = vendor.tags;
		this.selectedVendor = vendor;
		this.form.patchValue(vendor);
	}

	cancel() {
		this.addEditDialogRef?.close();
		this.form.reset();
		this.selectedVendor = null;
		this.tags = [];
		this.selected = {
			vendor: null,
			state: false
		};
		this.disabled = true;
		this.saveDisabled = false;
	}

	save() {
		this.saveDisabled = true;
		if (this.selectedVendor) {
			this.updateVendor(this.selectedVendor);
		} else {
			this.createVendor();
		}
	}

	/**
	 * Creates a new vendor using the provided form data.
	 * Creates the vendor using the organizationVendorsService and triggers a refresh.
	 */
	async createVendor(): Promise<void> {
		try {
			// Check if the form is not invalid
			if (!this.form.invalid) {
				// Extract necessary information from the current state
				const { name, phone, email, website } = this.form.value;
				const { tenantId } = this.store.user;
				const { id: organizationId } = this.organization;

				// Create the vendor using the organizationVendorsService
				await this.organizationVendorsService.create({
					name,
					phone,
					email,
					website,
					organizationId,
					tenantId,
					tags: this.tags
				});

				// Display a success toast message
				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.ADD_VENDOR', { name });
			} else {
				const toastrTitle = this.getTranslation('TOASTR.MESSAGE.NEW_ORGANIZATION_VENDOR_INVALID_NAME');

				// Display an error toast message for an invalid form
				this.toastrService.danger(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.INVALID_VENDOR_NAME',
					toastrTitle
				);
			}
		} catch (error) {
			// Handle errors using the errorHandlingService
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger refresh of data, notify observers, and perform cleanup
			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		}
	}

	/**
	 * Removes a vendor based on the provided id and name.
	 * Opens a confirmation dialog before performing the removal.
	 * If the user confirms, deletes the vendor and triggers a refresh.
	 *
	 * @param id - The identifier of the vendor to be removed.
	 * @param name - The name of the vendor to be displayed in the confirmation dialog.
	 */
	async removeVendor(id: string, name: string): Promise<void> {
		// Open a confirmation dialog using the DeleteConfirmationComponent
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('ORGANIZATIONS_PAGE.VENDOR')
				}
			}).onClose
		);

		// If the user confirms the deletion
		if (result) {
			try {
				// Delete the vendor using the organizationVendorsService
				await this.organizationVendorsService.delete(id);

				// Display a success toast message
				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.REMOVE_VENDOR', { name });
			} catch (error) {
				// Handle errors using the errorHandlingService
				this.errorHandlingService.handleError(error);
			} finally {
				// Trigger refresh of data
				this._refresh$.next(true);
				this.subject$.next(true);
			}
		}
	}

	/**
	 * Updates a vendor with the provided data.
	 * Updates the vendor using the organizationVendorsService and triggers a refresh.
	 *
	 * @param vendor - The vendor object to be updated.
	 */
	async updateVendor(vendor: IOrganizationVendor): Promise<void> {
		try {
			// Extract necessary information from the current state
			const { id: organizationId, tenantId } = this.organization;
			const { name, phone, email, website } = this.form.value;

			// Update the vendor using the organizationVendorsService
			await this.organizationVendorsService.update(vendor.id, {
				name,
				phone,
				email,
				website,
				tags: this.tags,
				organizationId,
				tenantId
			});

			// Display a success toast message
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_VENDOR.UPDATE_VENDOR', {
				name
			});
		} catch (error) {
			// Handle errors using the errorHandlingService
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger refresh of data, notify observers, and perform cleanup
			this._refresh$.next(true);
			this.subject$.next(true);
			this.cancel();
		}
	}

	/**
	 * Get vendors based on pagination settings and organization availability.
	 * Uses smartTableSource for data retrieval and updates pagination information.
	 */
	private async getVendors(): Promise<void> {
		// Check if the organization is not available
		if (!this.organization) {
			return;
		}

		try {
			// Retrieve activePage and itemsPerPage from pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set loading indicator to true
			this.loading = true;

			// Set up smartTableSource
			this.setSmartTableSource();

			// Set paging in smartTableSource
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Asynchronously retrieve elements using smartTableSource
			await this.smartTableSource.getElements();

			// Update pagination information with totalItems from smartTableSource
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});

			// Set loading indicator back to false
			this.loading = false;
		} catch (error) {
			// Handle errors using the errorHandlingService
			this.errorHandlingService.handleError(error);
		}
	}

	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/organization-vendors/pagination`,
			relations: ['tags'],
			where: {
				organizationId,
				tenantId
			},
			resultMap: (item: IOrganizationVendor) => {
				return Object.assign({}, item, {
					logo: item.name
				});
			},
			finalize: () => {
				this.vendors.push(...this.smartTableSource.getData());
			}
		});
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	/**
	 * Listens for language changes and triggers the loading of Smart Table settings.
	 * Unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}

	openDialog(template: TemplateRef<any>, isEditTemplate: boolean) {
		try {
			isEditTemplate ? this.edit(this.selectedVendor) : this.cancel();
			this.addEditDialogRef = this.dialogService.open(template);
		} catch (error) {
			console.log('An error occurred on open dialog: ' + error);
		}
	}

	selectVendor(vendor: any) {
		if (vendor.data) vendor = vendor.data;
		const res =
			this.selected.vendor && vendor.id === this.selected.vendor.id
				? { state: !this.selected.state }
				: { state: true };
		this.disabled = !res.state;
		this.selected.state = res.state;
		this.selected.vendor = vendor;
		this.selectedVendor = this.selected.vendor;
	}

	ngOnDestroy(): void {}
}
