import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { IWarehouse, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { InventoryStore, Store, WarehouseService } from '@gauzy/ui-core/core';
import { SelectProductComponent } from '../select-product-form/select-product-form.component';
import { ImageRowComponent } from '../../inventory-table-components/image-row.component';
import { ManageQuantityComponent } from '../manage-quantity/manage-quantity.component';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';
import { ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-warehouse-products-table',
    templateUrl: './warehouse-products-table.component.html',
    styleUrls: ['./warehouse-products-table.component.scss'],
    standalone: false
})
export class WarehouseProductsTableComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	loading: boolean = true;
	smartTableSource = new LocalDataSource();
	settingsSmartTable: object;

	public organization: IOrganization;
	products$: Subject<boolean> = new Subject();

	@Input() warehouse: IWarehouse;
	selectedWarehouse: any = {
		isSelected: false,
		data: null
	};

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly warehouseService: WarehouseService,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly inventoryStore: InventoryStore
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
	}

	ngAfterViewInit(): void {
		this.products$
			.pipe(
				debounceTime(100),
				tap(() => this.loadItems()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.inventoryStore.warehouseProductsCountUpdate$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			mode: 'external',
			selectedRowIndex: -1,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.WAREHOUSE_PRODUCT'),
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: ImageRowComponent,
					componentInitFunction: (instance: ImageRowComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string'
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'custom',
					renderComponent: ManageQuantityComponent,
					componentInitFunction: (instance: ManageQuantityComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			}
		};
	}

	handleImageUploadError(error) {
		this.toastrService.danger(error.error.message || error.message, 'TOASTR.TITLE.ERROR');
	}

	async loadItems() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const items = await this.warehouseService.getWarehouseProducts(this.warehouse.id);
			let mappedItems = items
				? items.map((item) => {
						return {
							...item,
							name: item.product.translations[0]['name'],
							featuredImage: item.product.featuredImage,
							quantity: item.quantity
						};
				  })
				: [];
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage);
			this.smartTableSource.load(mappedItems);
			this.setPagination({
				...this.getPagination(),
				totalItems: this.smartTableSource.count()
			});
		} catch (error) {
		} finally {
			this.loading = false;
		}
	}

	async onAddProduct() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const dialog = this.dialogService.open(SelectProductComponent, {});
		const selectedProducts = await firstValueFrom(dialog.onClose);

		let createWarehouseProductsInput = selectedProducts
			? selectedProducts.map((pr) => {
					return {
						productId: pr.id,
						variants: pr.variants.map((variant) => variant.id),
						tenantId,
						organizationId
					};
			  })
			: [];

		let result = await this.warehouseService.addWarehouseProducts(createWarehouseProductsInput, this.warehouse.id);

		if (createWarehouseProductsInput.length && result) {
			this.toastrService.success('INVENTORY_PAGE.SUCCESSFULLY_ADDED_PRODUCTS');
		}

		this.loadItems();
	}

	public selectWarehouse(event: any) {
		this.selectedWarehouse = event;
	}

	public get variants() {
		return this.selectedWarehouse && this.selectedWarehouse.data ? this.selectedWarehouse.data.variants : [];
	}
}
