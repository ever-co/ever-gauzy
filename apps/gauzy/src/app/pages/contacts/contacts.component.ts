import { Component, OnInit, ViewChild, Input, OnDestroy, ChangeDetectorRef, TemplateRef } from '@angular/core';
import { ActivatedRoute, Data, ParamMap, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationProject,
	ComponentLayoutStyleEnum,
	IOrganization,
	IContact,
	ICountry,
	ContactType,
	ContactOrganizationInviteStatus,
	IContactCreateInput
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Cell } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	CountryService,
	OrganizationContactService,
	OrganizationProjectsService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-sdk/core';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ContactWithTagsComponent, EmployeeWithLinksComponent, ProjectComponent } from '../../@shared/table-components';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-sdk/shared';
import { InputFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-contacts-list',
	templateUrl: './contacts.component.html',
	styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	showAddCard: boolean;
	organizationContacts: IOrganizationContact[] = [];
	projectsWithoutOrganizationContacts: IOrganizationProject[] = [];
	selectedOrganizationContact: IOrganizationContact;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	contactOrganizationInviteStatus = ContactOrganizationInviteStatus;
	settingsSmartTable: object;
	countries: ICountry[] = [];
	disableButton = true;
	loading = false;
	smartTableSource: ServerDataSource;

	public contacts$: Subject<any> = this.subject$;
	public organization: IOrganization;
	public selectedEmployeeId: string;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Getter & Setter for contact type
	 */
	_contactType: string = ContactType.CUSTOMER;
	get contactType(): string {
		return this._contactType;
	}
	@Input() set contactType(value: string) {
		this._contactType = value;
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly countryService: CountryService,
		private readonly cd: ChangeDetectorRef,
		private readonly _router: Router,
		private readonly http: HttpClient
	) {
		super(translateService);
		this.countryService.find$.next(true);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.route.data
			.pipe(
				tap((params: Data) => (this.contactType = params.contactType)),
				tap(() => this.setView()),
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
		this.contacts$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(async () => {
					await this.loadProjectsWithoutOrganizationContacts();
					await this.getContacts();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.contacts$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.contacts$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => !!params.get('id')),
				tap(async (params: ParamMap) => await this._initEditMethod(params.get('id'))),
				untilDestroyed(this)
			)
			.subscribe();
		this.countryService.countries$
			.pipe(
				tap((countries: ICountry[]) => (this.countries = countries)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.organizationContacts = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _initEditMethod(id: string) {
		if (id) {
			this.loading = true;
			const { tenantId } = this.store.user;
			try {
				const items = await this.organizationContactService.getById(id, tenantId, [
					'projects',
					'members',
					'members.user',
					'tags',
					'contact'
				]);

				if (items) {
					this.editOrganizationContact(items);
				}
			} catch (error) {
				this.toastrService.danger(this.getTranslation('TOASTR.TITLE.ERROR'));
			}
			this.loading = false;
			this.cd.detectChanges();
		}
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getNoDataMessage(),
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					width: '15%',
					type: 'custom',
					class: 'align-row',
					renderComponent: ContactWithTagsComponent,
					componentInitFunction: (instance: ContactWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					}
				},
				members: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'),
					type: 'custom',
					filter: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				primaryPhone: {
					title: this.getTranslation('CONTACTS_PAGE.PHONE'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (primaryPhone: string) => {
						this.setFilter({ field: 'primaryPhone', search: primaryPhone });
					}
				},
				primaryEmail: {
					title: this.getTranslation('CONTACTS_PAGE.EMAIL'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (primaryEmail: string) => {
						this.setFilter({
							field: 'primaryEmail',
							search: primaryEmail
						});
					}
				},
				projects: {
					title: this.getTranslation('CONTACTS_PAGE.PROJECTS'),
					type: 'custom',
					filter: false,
					renderComponent: ProjectComponent,
					componentInitFunction: (instance: ProjectComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				country: {
					title: this.getTranslation('CONTACTS_PAGE.COUNTRY'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (value: string) => this.getCountry(value)
				},
				city: {
					title: this.getTranslation('CONTACTS_PAGE.CITY'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	private getNoDataMessage() {
		let noDataMessage: string;
		switch (this.contactType) {
			case ContactType.CLIENT:
				noDataMessage = this.getTranslation('SM_TABLE.NO_DATA.CLIENT');
				break;
			case ContactType.LEAD:
				noDataMessage = this.getTranslation('SM_TABLE.NO_DATA.LEAD');
				break;
			default:
				noDataMessage = this.getTranslation('SM_TABLE.NO_DATA.CONTACT');
				break;
		}
		return noDataMessage;
	}

	public onUpdateResult(params: any) {
		if (params) this.invite(params);
	}

	selectContact({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedOrganizationContact = isSelected ? data : null;
	}

	async removeOrganizationContact(id?: string, name?: string) {
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Contact'
				}
			}).onClose
		);

		if (result) {
			await this.organizationContactService.delete(
				this.selectedOrganizationContact ? this.selectedOrganizationContact.id : id
			);

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.REMOVE_CONTACT', {
				name: this.selectedOrganizationContact ? this.selectedOrganizationContact.name : name
			});
			this._refresh$.next(true);
			this.contacts$.next(true);
		}
	}

	setView() {
		switch (this.contactType) {
			case ContactType.CLIENT:
				this.viewComponentName = ComponentEnum.CLIENTS;
				break;
			case ContactType.LEAD:
				this.viewComponentName = ComponentEnum.LEADS;
				break;
			default:
				this.viewComponentName = ComponentEnum.CUSTOMERS;
				break;
		}
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.organizationContacts = [])),
				tap(() => this.contacts$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Manages adding or updating an organization contact and displays relevant notifications.
	 *
	 * @param organizationContact
	 * @returns
	 */
	public async addOrEditOrganizationContact(organizationContact: IOrganizationContactCreateInput) {
		if (!this.organization) {
			return;
		}

		const contact: IContactCreateInput = this.extractLocation(organizationContact.contact);
		const request = {
			...organizationContact,
			contact
		};

		try {
			if (organizationContact.name) {
				const { name } = organizationContact;

				if (organizationContact.id) {
					await this.organizationContactService.update(organizationContact.id, request);
					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.UPDATE_CONTACT', {
						name
					});
				} else {
					await this.organizationContactService.create(request);
					this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT', { name });
				}

				this.showAddCard = !this.showAddCard;
				this._refresh$.next(true);
				this.contacts$.next(true);
			} else {
				this.toastrService.danger('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVALID_CONTACT_DATA');
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	/**
	 * A contact object with organization and tenant details from the current organization context.
	 *
	 * @param contact The contact object to be enriched.
	 * @returns An enriched contact object containing location details, organization, and tenant information.
	 */
	private extractLocation(contact: IContactCreateInput): IContactCreateInput | undefined {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		return {
			...contact,
			organizationId,
			organization: { id: organizationId },
			tenantId,
			tenant: { id: tenantId }
		};
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		try {
			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/organization-contact/pagination`,
				relations: ['projects.members', 'members.user', 'tags', 'contact'],
				join: {
					alias: 'organization_contact',
					leftJoin: {
						members: 'organization_contact.members'
					}
				},
				where: {
					organizationId,
					tenantId,
					contactType: this.contactType,
					...(this.selectedEmployeeId
						? {
								members: [this.selectedEmployeeId]
						  }
						: {}),
					...(this.filters.where ? this.filters.where : {})
				},
				resultMap: (contact: IOrganizationContact) => {
					return Object.assign({}, contact, {
						country: contact.contact ? contact.contact.country : '',
						city: contact.contact ? contact.contact.city : '',
						street: contact.contact ? contact.contact.address : '',
						street2: contact.contact ? contact.contact.address2 : '',
						postcode: contact.contact ? contact.contact.postcode : null,
						fax: contact.contact ? contact.contact.fax : '',
						website: contact.contact ? contact.contact.website : '',
						fiscalInformation: contact.contact ? contact.contact.fiscalInformation : ''
					});
				},
				finalize: () => {
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this.toastrService.danger(this.getTranslation('TOASTR.TITLE.ERROR'));
		}
	}

	private async getContacts() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			await this._loadGridLayoutData();
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private async _loadGridLayoutData() {
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.organizationContacts.push(...(await this.smartTableSource.getElements()));
		}
	}

	private async loadProjectsWithoutOrganizationContacts() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		try {
			const { items } = await this.organizationProjectsService.getAll(['organizationContact'], {
				organizationId,
				tenantId,
				organizationContactId: null
			});
			this.projectsWithoutOrganizationContacts = items;
		} catch (error) {
			this.toastrService.danger(this.getTranslation('TOASTR.TITLE.ERROR'));
		}
		this.cd.detectChanges();
	}

	cancel() {
		this.loading = true;
		this.selectedOrganizationContact = null;
		this.showAddCard = !this.showAddCard;
	}

	async editOrganizationContact(organizationContact: IOrganizationContact) {
		await this.loadProjectsWithoutOrganizationContacts();
		this.selectedOrganizationContact = organizationContact;
		this.showAddCard = true;
		this.loading = false;
	}

	async add() {
		this.selectedOrganizationContact = null;
		this.showAddCard = true;
	}

	/**
	 * Redirect contact/client/customer to view page
	 *
	 * @returns
	 */
	navigateToContact(selectedItem?: IContact) {
		if (selectedItem) {
			this.selectContact({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedOrganizationContact) {
			return;
		}
		const { id } = this.selectedOrganizationContact;
		this._router.navigate([`/pages/contacts/view`, id]);
	}

	async invite(selectedOrganizationContact?: IOrganizationContact) {
		try {
			const { id: organizationId } = this.organization;
			const dialog = this.dialogService.open(InviteContactComponent, {
				context: {
					organizationId,
					organizationContact: selectedOrganizationContact,
					contactType: this.contactType,
					selectedOrganization: this.organization
				}
			});

			const result = await firstValueFrom(dialog.onClose);

			if (result) {
				this._refresh$.next(true);
				this.contacts$.next(true);
				this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT', {
					name: result.name
				});
			}
		} catch (error) {
			this.toastrService.danger('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT_ERROR');
		}
	}

	public _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectContact({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Returns the country name based on the ISO code.
	 *
	 * @param isoCode - ISO code of the country.
	 * @returns The country name or null if not found.
	 */
	getCountry(isoCode: ICountry['isoCode']): string | null {
		// Logic to find the country based on the ISO code
		const country = this.countries.find((item) => item.isoCode === isoCode);

		// Return the country name if found, otherwise return null
		return country?.country ?? null;
	}

	ngOnDestroy(): void {}
}
