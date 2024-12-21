import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ComponentLayoutStyleEnum, IOrganization, IWarehouse, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import { ServerDataSource, Store, ToastrService, WarehouseService } from '@gauzy/ui-core/core';
import {
	DeleteConfirmationComponent,
	IPaginationBase,
	InputFilterComponent,
	PaginationFilterBaseComponent
} from '@gauzy/ui-core/shared';
import { ContactRowComponent, EnabledStatusComponent, ItemImgTagsComponent } from '../../inventory-table-components';
import { DescriptionComponent } from '../../inventory-table-components/description/description.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-warehouses',
    templateUrl: './warehouses-table.component.html',
    styleUrls: ['./warehouses-table.component.scss'],
    standalone: false
})
export class WarehousesTableComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	settingsSmartTable: object;
	loading: boolean = false;
	disableButton: boolean = true;
	selectedWarehouse: IWarehouse;
	smartTableSource: ServerDataSource;
	warehouses: IWarehouse[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	public warehouses$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true }) actionButtons: TemplateRef<any>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly warehouseService: WarehouseService,
		private readonly toastrService: ToastrService,
		private readonly router: Router,
		private readonly store: Store,
		private readonly http: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit(): void {
		this.warehouses$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getWarehouses()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.warehouses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		storeOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.warehouses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.warehouses = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.WAREHOUSE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.warehouses = [])),
				tap(() => this.warehouses$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.WAREHOUSE'),
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.LOGO'),
					type: 'custom',
					renderComponent: ItemImgTagsComponent,
					componentInitFunction: (instance: ItemImgTagsComponent, cell: Cell) => {
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
				email: {
					title: this.getTranslation('INVENTORY_PAGE.EMAIL'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (email: string) => {
						this.setFilter({ field: 'email', search: email });
					}
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string',
					isFilterable: false
				},
				contact: {
					title: this.getTranslation('INVENTORY_PAGE.CONTACT'),
					type: 'custom',
					isFilterable: false,
					renderComponent: ContactRowComponent,
					componentInitFunction: (instance: ContactRowComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DescriptionComponent,
					componentInitFunction: (instance: DescriptionComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				active: {
					title: this.getTranslation('INVENTORY_PAGE.ACTIVE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EnabledStatusComponent,
					componentInitFunction: (instance: EnabledStatusComponent, cell: Cell) => {
						instance.value = cell.getValue();
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

	onCreateWarehouse() {
		if (!this.store.hasPermission(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)) {
			return;
		}
		this.router.navigate(['/pages/organization/inventory/warehouses/create']);
	}

	onUpdateWarehouse(selectedItem?: IWarehouse) {
		if (selectedItem) {
			this.selectWarehouse({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.store.hasPermission(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)) {
			return;
		}
		const { id } = this.selectedWarehouse;
		this.router.navigate(['/pages/organization/inventory/warehouses/edit', id]);
	}

	async onDelete(selectedItem?: IWarehouse) {
		if (selectedItem) {
			this.selectWarehouse({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedWarehouse) {
			return;
		}
		if (!this.store.hasPermission(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)) {
			return;
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);
		if (result) {
			await this.warehouseService
				.deleteFeaturedImage(this.selectedWarehouse.id)
				.then((res) => {
					if (res && res.affected == 1) {
						const { name } = this.selectedWarehouse;
						this.toastrService.success('INVENTORY_PAGE.WAREHOUSE_WAS_DELETED', {
							name
						});
					}
				})
				.finally(() => {
					this._refresh$.next(true);
					this.warehouses$.next(true);
				});
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/warehouses/pagination`,
				relations: ['logo', 'contact'],
				where: {
					organizationId,
					tenantId,
					...(this.filters.where ? this.filters.where : {})
				},
				finalize: () => {
					if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
						this.warehouses.push(...this.smartTableSource.getData());
					}
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this.toastrService.danger(error);
			this.loading = false;
		}
	}

	/**
	 * GET warehouse smart table source
	 */
	private async getWarehouses() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectWarehouse({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedWarehouse = isSelected ? data : null;
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectWarehouse({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
