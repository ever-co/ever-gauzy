import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { IOrganization, ComponentLayoutStyleEnum, IUser, CrudActionEnum } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	OrganizationEditStore,
	OrganizationsService,
	Store,
	ToastrService,
	UsersOrganizationsService
} from '@gauzy/ui-core/core';
import {
	DeleteConfirmationComponent,
	IPaginationBase,
	IRecordViewSection,
	OrganizationWithTagsComponent,
	OrganizationsMutationComponent,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';
import {
	OrganizationsCurrencyComponent,
	OrganizationTotalEmployeesCountComponent,
	OrganizationsStatusComponent
} from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
    templateUrl: './organizations.component.html',
    styleUrls: ['./organizations.component.scss'],
    standalone: false
})
export class OrganizationsComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	settingsSmartTable: object;
	selectedOrganization: IOrganization;

	/*
	 * Read-only View: a summary of the grid columns plus the identity fields
	 * opens in the right-side drawer — full management already lives on the
	 * edit page, so the record does not warrant a page of its own.
	 */
	viewedOrganization: IOrganization;
	viewSections: IRecordViewSection[] = [];

	smartTableSource = new LocalDataSource();
	organizations: IOrganization[] = [];
	viewComponentName: ComponentEnum;
	disableButton: boolean = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	loading: boolean = true;
	user: IUser;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		private readonly organizationsService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly store: Store,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this._loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.queryParamMap
			.pipe(
				debounceTime(1000),
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				tap(() => this.addOrganization()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.organizations = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.ORGANIZATION;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter(() => this._isGridLayout),
				tap(() => (this.organizations = [])),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectOrganization({ isSelected, data }) {
		// Whatever the drawer is showing no longer matches the selection.
		this.closeView();
		this.disableButton = !isSelected;
		this.selectedOrganization = isSelected ? data : null;
	}

	/**
	 * Opens the read-only View of an organization in the right-side drawer.
	 *
	 * @param selectedItem - Row the action was invoked from, when it came from the grid.
	 */
	viewOrganization(selectedItem?: IOrganization): void {
		if (selectedItem) {
			this.selectOrganization({ isSelected: true, data: selectedItem });
		}

		const organization = selectedItem ?? this.selectedOrganization;
		if (!organization) {
			return;
		}

		this.viewSections = this.buildViewSections(organization);
		this.viewedOrganization = organization;
	}

	closeView(): void {
		this.viewedOrganization = null;
	}

	/**
	 * Field descriptor for the drawer — the grid columns read vertically, then
	 * the identity fields the grid has no room for. Takes the record because
	 * some values are derived (employee count, mapped status, translated enums)
	 * rather than read off a dot path.
	 */
	private buildViewSections(organization: IOrganization): IRecordViewSection[] {
		return [
			{
				fields: [
					{ label: 'FORM.LABELS.ORGANIZATION_NAME', key: 'name' },
					// Computed in _loadSmartTable (active employees only), not a persisted field.
					{ label: 'SM_TABLE.EMPLOYEES', value: organization.totalEmployees },
					{ label: 'SM_TABLE.CURRENCY', key: 'currency' },
					{
						label: 'SM_TABLE.STATUS',
						type: 'badge',
						value: {
							text: this.getTranslation(
								organization.isActive ? 'ORGANIZATIONS_PAGE.ACTIVE' : 'ORGANIZATIONS_PAGE.ARCHIVED'
							),
							class: organization.isActive ? 'success' : 'danger'
						}
					}
				]
			},
			{
				fields: [
					{ label: 'FORM.LABELS.OFFICIAL_NAME', key: 'officialName' },
					{ label: 'FORM.LABELS.WEBSITE', key: 'website', type: 'link' },
					{ label: 'FORM.LABELS.TAX_ID', key: 'taxId' },
					{ label: 'FORM.LABELS.REGISTRATION_DATE', key: 'registrationDate', type: 'date' },
					// Enum values go through the same SM_TABLE.<VALUE> keys the org forms use.
					{
						label: 'FORM.LABELS.START_WEEK_ON',
						value: organization.startWeekOn
							? this.getTranslation(`SM_TABLE.${organization.startWeekOn}`)
							: null
					},
					{
						label: 'FORM.LABELS.DATE_TYPE',
						value: organization.defaultValueDateType
							? this.getTranslation(`SM_TABLE.${organization.defaultValueDateType}`)
							: null
					},
					{ label: 'TIMESHEET.TIME_ZONE', key: 'timeZone' },
					{ label: 'SM_TABLE.TAGS', key: 'tags', type: 'tags', wide: true }
				]
			}
		];
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'custom',
					renderComponent: OrganizationWithTagsComponent,
					componentInitFunction: (instance: OrganizationWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				totalEmployees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					width: '200px',
					isFilterable: false,
					renderComponent: OrganizationTotalEmployeesCountComponent,
					componentInitFunction: (instance: OrganizationTotalEmployeesCountComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				currency: {
					title: this.getTranslation('SM_TABLE.CURRENCY'),
					type: 'custom',
					width: '200px',
					renderComponent: OrganizationsCurrencyComponent,
					componentInitFunction: (instance: OrganizationsCurrencyComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					isFilterable: false,
					renderComponent: OrganizationsStatusComponent,
					componentInitFunction: (instance: OrganizationsStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				}
			}
		};
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Opens a dialog to add a new organization and handles the result.
	 */
	async addOrganization() {
		try {
			// Opens the dialog for adding a new organization and returns the result.
			const dialog = this.dialogService.open(OrganizationsMutationComponent);
			const data = await firstValueFrom(dialog.onClose);

			if (data) {
				this.loading = true; // Indicate loading state

				// Organization service to create a new organization
				const organization = await this.organizationsService.create(data);

				// Handles operations after successfully creating an organization
				if (organization) {
					this._organizationEditStore.organizationAction = {
						organization,
						action: CrudActionEnum.CREATED
					};
					this.toastrService.success('NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION', { name: organization.name });
				}

				// Finalizes operations after adding an organization, such as updating subjects.
				this._refresh$.next(true);
				this.subject$.next(true);
			}
		} catch (error) {
			// Handles errors occurred during the operation
			this.errorHandler.handleError(error);
		} finally {
			this.loading = false; // Update loading state
		}
	}

	async editOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate(['/pages/organizations/edit/' + this.selectedOrganization.id]);
	}

	async deleteOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'ORGANIZATIONS_PAGE.ORGANIZATION'
				}
			}).onClose
		);

		if (result) {
			try {
				await this.organizationsService
					.delete(this.selectedOrganization.id)
					.then(() => {
						this._organizationEditStore.organizationAction = {
							organization: this.selectedOrganization,
							action: CrudActionEnum.DELETED
						};
						this.toastrService.success('NOTES.ORGANIZATIONS.DELETE_ORGANIZATION', {
							name: this.selectedOrganization.name
						});
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					})
					.finally(() => {
						this.clearItem();
						this._refresh$.next(true);
						this.subject$.next(true);
					});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	private async _loadSmartTable() {
		try {
			const { items } = await this.userOrganizationService.getAll(
				['organization', 'organization.tags', 'organization.employees'],
				{ userId: this.store.userId, tenantId: this.user.tenantId }
			);

			const { itemsPerPage, activePage } = this.getPagination();

			const organizations = items.map((userOrganization) => userOrganization.organization);

			for (const org of organizations) {
				const activeEmployees = org.employees.filter((i) => i.isActive);
				org.totalEmployees = activeEmployees.length;
				delete org['employees'];
			}
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.smartTableSource.load(organizations);
			this._loadDataGridLayout();
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}

		this.loading = false;
	}

	private async _loadDataGridLayout() {
		if (this._isGridLayout) {
			this.organizations.push(...(await this.smartTableSource.getElements()));
		}
	}

	private get _isGridLayout(): boolean {
		return this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		// The record the drawer is showing follows the selection — a delete or
		// reload must not leave a detached record open.
		this.closeView();
		this.selectOrganization({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
