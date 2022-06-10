import {
	Component,
	OnInit,
	ViewChild,
	Input,
	OnDestroy,
	ChangeDetectorRef,
	TemplateRef
} from '@angular/core';
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
	ContactOrganizationInviteStatus
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import {
	CountryService,
	OrganizationContactService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '../../@core/services';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	ContactWithTagsComponent,
	EmployeeWithLinksComponent,
	ProjectComponent
} from '../../@shared/table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { InputFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contacts',
	templateUrl: './contacts.component.html',
	styleUrls: ['./contacts.component.scss']
})
export class ContactsComponent extends PaginationFilterBaseComponent 
	implements OnInit, OnDestroy {
	
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
	disableButton: boolean = true;
	loading: boolean = false;
	smartTableSource: ServerDataSource;

	contacts$: Subject<any> = this.subject$;
	public organization: IOrganization;
	selectedEmployeeId: string;

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

	contactsTable: Ng2SmartTableComponent;
	@ViewChild('contactsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.contactsTable = content;
			this.onChangedSource();
		}
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
		this._loadSmartTableSettings();
		this.route.data
			.pipe(
				tap((params: Data) => this.contactType = params.contactType),
				tap(() => this.setView()),
				untilDestroyed(this)
			)
			.subscribe();
		this.contacts$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getContacts()),
				tap(() => this.loadProjectsWithoutOrganizationContacts()),
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
				tap(() => this.refreshPagination()),
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
				tap((params: ParamMap) => this._initEditMethod(params.get('id'))),
				untilDestroyed(this)
			)
			.subscribe();
		this.countryService.countries$
			.pipe(
				tap((countries: ICountry[]) => (this.countries = countries)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _initEditMethod(id: string) {
		if (id) {
			const { tenantId } = this.store.user;
			this.organizationContactService
				.getById(id, tenantId, [
					'projects',
					'members',
					'members.user',
					'tags',
					'contact'
				])
				.then((items) => {
					if (items) {
						this.editOrganizationContact(items);
					}
				})
				.catch(() => {
					this.toastrService.danger(
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
				})
				.finally(() => {
					this.loading = false;
					this.cd.detectChanges();
				});
		}
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: ContactWithTagsComponent,
					width: '15%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					},
				},
				members: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.TEAMS_PAGE.MEMBERS'
					),
					type: 'custom',
					renderComponent: EmployeeWithLinksComponent,
					filter: false
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
					},
				},
				primaryEmail: {
					title: this.getTranslation('CONTACTS_PAGE.EMAIL'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (primaryEmail: string) => {
						this.setFilter({ field: 'primaryEmail', search: primaryEmail });
					},
				},
				projects: {
					title: this.getTranslation('CONTACTS_PAGE.PROJECTS'),
					type: 'custom',
					renderComponent: ProjectComponent,
					filter: false
				},
				country: {
					title: this.getTranslation('CONTACTS_PAGE.COUNTRY'),
					type: 'string',
					valuePrepareFunction: (value, item) => {
						return this.getCountry(item);
					},
					filter: false
				},
				city: {
					title: this.getTranslation('CONTACTS_PAGE.CITY'),
					type: 'string',
					filter: false
				},
				street: {
					title: this.getTranslation('CONTACTS_PAGE.STREET'),
					type: 'string',
					filter: false
				}
			}
		};
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
				this.selectedOrganizationContact
					? this.selectedOrganizationContact.id
					: id
			);

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.REMOVE_CONTACT',
				{
					name: this.selectedOrganizationContact
						? this.selectedOrganizationContact.name
						: name
				}
			);

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
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.contacts$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public async addOrEditOrganizationContact(
		organizationContact: IOrganizationContactCreateInput
	) {
		const contact: IContact = {
			country: organizationContact.country,
			city: organizationContact.city,
			address: organizationContact.address,
			address2: organizationContact.address2,
			postcode: organizationContact.postcode,
			fax: organizationContact.fax,
			fiscalInformation: organizationContact.fiscalInformation,
			website: organizationContact.website,
			latitude: organizationContact.latitude,
			longitude: organizationContact.longitude
		};
		const organizationContactData = {
			...organizationContact,
			contact
		};
		if (organizationContact.name) {
			await this.organizationContactService.create(
				organizationContactData
			);

			this.showAddCard = !this.showAddCard;

			let toasterMessage: string =
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT';
			if (organizationContact.id) {
				toasterMessage =
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.UPDATE_CONTACT';
			}
			this.toastrService.success(toasterMessage, {
				name: organizationContact.name
			});

			this.contacts$.next(true);
		} else {
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVALID_CONTACT_DATA'
			);
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.selectedEmployeeId) request['employeeId'] = this.selectedEmployeeId;

		try {
			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/organization-contact/pagination`,
				relations: [
					'projects',
					'projects.members',
					'projects.organization',
					'members',
					'members.user',
					'tags',
					'contact'
				],
				where: {
					...{
						organizationId,
						tenantId,
						contactType: this.contactType,
					},
					...request,
					...this.filters.where
				},
				resultMap: (contact: IOrganizationContact) => {
					return Object.assign({}, contact, {
						country: contact.contact ? contact.contact.country : '',
						city: contact.contact ? contact.contact.city : '',
						street: contact.contact ? contact.contact.address : '',
						street2: contact.contact
							? contact.contact.address2
							: '',
						postcode: contact.contact
							? contact.contact.postcode
							: null,
						fax: contact.contact ? contact.contact.fax : '',
						website: contact.contact ? contact.contact.website : '',
						fiscalInformation: contact.contact
							? contact.contact.fiscalInformation
							: ''
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
			this.toastrService.danger(
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
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
			this.organizationContacts = await this.smartTableSource.getElements();
		}
	}

	private async loadProjectsWithoutOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.organizationProjectsService
			.getAll(['organizationContact'], {
				organizationId,
				tenantId,
				organizationContact: null
			})
			.then(({ items }) => {
				this.projectsWithoutOrganizationContacts = items;
			})
			.catch(() => {
				this.toastrService.danger(
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
			})
			.finally(() => {
				this.loading = false;
				this.cd.detectChanges();
			});
	}

	cancel() {
		this.selectedOrganizationContact = null;
		this.showAddCard = !this.showAddCard;
	}

	async editOrganizationContact(organizationContact: IOrganizationContact) {
		await this.loadProjectsWithoutOrganizationContacts();
		this.selectedOrganizationContact = organizationContact;
		this.showAddCard = true;
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
				this.contacts$.next(true);
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT',
					{
						name: result.name
					}
				);
			}
		} catch (error) {
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVITE_CONTACT_ERROR'
			);
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
	 * Table on changed source event
	 */
	onChangedSource() {
		this.contactsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
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
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.contactsTable && this.contactsTable.grid) {
			this.contactsTable.grid.dataSet['willSelect'] = 'false';
			this.contactsTable.grid.dataSet.deselectAll();
		}
	}

	getCountry(row) {
		const find: ICountry = this.countries.find(
			(item) => item.isoCode === row.country
		);
		return find ? find.country : row.country;
	}

	ngOnDestroy(): void {}
}
