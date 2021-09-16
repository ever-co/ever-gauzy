import {
	Component,
	OnInit,
	ViewChild,
	Input,
	OnDestroy,
	ChangeDetectorRef,
	TemplateRef
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationProject,
	ComponentLayoutStyleEnum,
	IOrganization,
	IContact,
	ICountry
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject } from 'rxjs';
import {
	debounceTime,
	filter,
	first,
	tap
} from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { InviteContactComponent } from './invite-contact/invite-contact.component';
import { TranslationBaseComponent } from '../../@shared/language-base';
import {
	CountryService,
	OrganizationContactService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '../../@core/services';
import { ComponentEnum } from '../../@core/constants';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { EmployeeWithLinksComponent, PictureNameTagsComponent, TaskTeamsComponent } from '../../@shared/table-components';
import { ContactActionComponent } from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-contact',
	templateUrl: './contact.component.html',
	styleUrls: ['./contact.component.scss']
})
export class ContactComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	showAddCard: boolean;
	organizationContact: IOrganizationContact[] = [];
	projectsWithoutOrganizationContact: IOrganizationProject[];
	selectProjects: string[] = [];
	organizationContactToEdit: IOrganizationContact;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	settingsSmartTable: object;
	selectedContact: any;
	isGridEdit: boolean;
	disableButton = true;
	countries: ICountry[] = [];
	loading: boolean;
	smartTableSource = new LocalDataSource();

	subject$: Subject<any> = new Subject();
	public organization: IOrganization;
	selectedEmployeeId: string;

	/*
	* Getter & Setter for contact type
	*/
	_contactType: string;
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
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly countryService: CountryService,
		private readonly cd: ChangeDetectorRef
	) {
		super(translateService);
		this.setView();
		this.countryService.find$.next(true);
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.loadOrganizationContacts()),
				tap(() => this.loadProjectsWithoutOrganizationContacts()),
				tap(() => this.clearItem()),
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
					this.subject$.next();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this.countryService.countries$
			.pipe(
				tap((countries: ICountry[]) => (this.countries = countries)),
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}


	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				contact_name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: PictureNameTagsComponent
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
					type: 'string'
				},
				primaryEmail: {
					title: this.getTranslation('CONTACTS_PAGE.EMAIL'),
					type: 'string'
				},
				projects: {
					title: this.getTranslation('CONTACTS_PAGE.PROJECTS'),
					type: 'custom',
					renderComponent: TaskTeamsComponent,
					filter: false
				},
				country: {
					title: this.getTranslation('CONTACTS_PAGE.COUNTRY'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (value, item) => {
						return this.getCountry(item);
					}
				},
				city: {
					title: this.getTranslation('CONTACTS_PAGE.CITY'),
					type: 'string'
				},
				street: {
					title: this.getTranslation('CONTACTS_PAGE.STREET'),
					type: 'string'
				},
				actions: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_ACTIONS'
					),
					type: 'custom',
					renderComponent: ContactActionComponent,
					onComponentInitFunction: (instance) => {
						instance.updateResult.subscribe((params) => {
							this.invite(params);
						});
					},
					filter: false
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	selectContact({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedContact = isSelected ? data : null;
	}

	async removeOrganizationContact(id?: string, name?: string) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Contact'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.organizationContactService.delete(
				this.selectedContact ? this.selectedContact.id : id
			);

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.REMOVE_CONTACT',
				{
					name: this.selectedContact
						? this.selectedContact.name
						: name
				}
			);

			this.loadOrganizationContacts();
		}
	}

	setView() {
		this.viewComponentName = ComponentEnum.CONTACTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedContact =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedContact;
			});
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
			this.selectProjects = [];

			let toasterMessage: string =
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.ADD_CONTACT';
			if (organizationContact.id) {
				toasterMessage =
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.UPDATE_CONTACT';
			}
			this.toastrService.success(toasterMessage, {
				name: organizationContact.name
			});

			this.loadOrganizationContacts();
		} else {
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CONTACTS.INVALID_CONTACT_DATA'
			);
		}
	}

	private async loadOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const findObj = {
			organizationId,
			tenantId,
			contactType: this.contactType
		};
		if (this.selectedEmployeeId) {
			findObj['employeeId'] = this.selectedEmployeeId;
		}

		this.organizationContactService
			.getAll(
				['projects', 'members', 'members.user', 'tags', 'contact'],
				findObj
			)
			.then(({ items = [] }) => {
				const result = [];
				items.forEach((contact: IOrganizationContact) => {
					result.push({
						...contact,
						contact_name: contact.name,
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
				});
				this.organizationContact = result;
				this.smartTableSource.load(result);
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
				this.projectsWithoutOrganizationContact = items;
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
		this.organizationContactToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	async editOrganizationContact(organizationContact: IOrganizationContact) {
		await this.loadProjectsWithoutOrganizationContacts();
		this.organizationContactToEdit = organizationContact
			? organizationContact
			: this.selectedContact;
		this.isGridEdit = organizationContact ? false : true;
		this.showAddCard = true;
	}

	async add() {
		this.organizationContactToEdit = null;
		this.showAddCard = true;
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

			const result = await dialog.onClose.pipe(first()).toPromise();

			if (result) {
				await this.loadOrganizationContacts();
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
				tap(() => this.loadSmartTable()),
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
