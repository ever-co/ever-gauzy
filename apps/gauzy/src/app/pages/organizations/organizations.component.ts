import {
	AfterViewInit,
	Component,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import {
	IOrganization,
	ComponentLayoutStyleEnum,
	IUser,
	CrudActionEnum
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	ErrorHandlingService,
	OrganizationsService,
	OrganizationEditStore,
	Store,
	ToastrService,
	UsersOrganizationsService
} from '../../@core/services';
import { OrganizationsMutationComponent } from '../../@shared/organizations/organizations-mutation/organizations-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	OrganizationsCurrencyComponent,
	OrganizationsEmployeesComponent,
	OrganizationsStatusComponent
} from './table-components';
import { ComponentEnum } from '../../@core/constants';
import { OrganizationWithTagsComponent } from '../../@shared/table-components/organization-with-tags/organization-with-tags.component';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './organizations.component.html',
	styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {
	settingsSmartTable: object;
	selectedOrganization: IOrganization;
	smartTableSource = new LocalDataSource();
	organizations: IOrganization[] = [];
	viewComponentName: ComponentEnum;
	disableButton: boolean = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	loading: boolean = true;
	user: IUser;
	private _refresh$: Subject<any> = new Subject();

	organizationsTable: Ng2SmartTableComponent;
	@ViewChild('organizationsTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.organizationsTable = content;
			this.onChangedSource();
		}
	}

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
				filter(
					(params: ParamMap) => params.get('openAddDialog') === 'true'
				),
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
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => this.refreshPagination()),
				filter(() => this._isGridLayout),
				tap(() => (this.organizations = [])),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectOrganization({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedOrganization = isSelected ? data : null;
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
					type: 'custom',
					renderComponent: OrganizationWithTagsComponent
				},
				totalEmployees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					width: '200px',
					filter: false,
					renderComponent: OrganizationsEmployeesComponent
				},
				currency: {
					title: this.getTranslation('SM_TABLE.CURRENCY'),
					type: 'custom',
					width: '200px',
					renderComponent: OrganizationsCurrencyComponent
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					filter: false,
					renderComponent: OrganizationsStatusComponent
				}
			},
			pager: {
				display: false,
				perPage: pagination
					? pagination.itemsPerPage
					: this.minItemPerPage
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

	async addOrganization() {
		const result = await firstValueFrom(
			this.dialogService.open(OrganizationsMutationComponent).onClose
		);
		if (result) {
			try {
				this.organizationsService
					.create(result)
					.then((organization: IOrganization) => {
						if (organization) {
							this._organizationEditStore.organizationAction = {
								organization,
								action: CrudActionEnum.CREATED
							};
							this.toastrService.success(
								'NOTES.ORGANIZATIONS.ADD_NEW_ORGANIZATION',
								{
									name: result.name
								}
							);
						}
					})
					.catch((error) => {
						this.errorHandler.handleError(error);
					})
					.finally(() => {
						this._refresh$.next(true);
						this.subject$.next(true);
					});
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}

	async editOrganization(selectedItem?: IOrganization) {
		if (selectedItem) {
			this.selectOrganization({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrganization.id
		]);
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
						this.toastrService.success(
							'NOTES.ORGANIZATIONS.DELETE_ORGANIZATION',
							{
								name: this.selectedOrganization.name
							}
						);
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

			const organizations = items.map(
				(userOrganization) => userOrganization.organization
			);

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
			this.organizations.push(
				...(await this.smartTableSource.getElements())
			);
		}
	}

	private get _isGridLayout(): boolean {
		return (
			this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID
		);
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.organizationsTable.source.onChangedSource
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
		this.selectOrganization({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.organizationsTable && this.organizationsTable.grid) {
			this.organizationsTable.grid.dataSet['willSelect'] = 'false';
			this.organizationsTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() { }
}
