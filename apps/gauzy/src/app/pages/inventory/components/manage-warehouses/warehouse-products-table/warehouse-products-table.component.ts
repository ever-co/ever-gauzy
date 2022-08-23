import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import {
	IWarehouse,
	IOrganization
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { filter, firstValueFrom, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from './../../../../../@shared/language-base/translation-base.component';
import { InventoryStore, Store, ToastrService, WarehouseService } from './../../../../../@core/services';
import { SelectProductComponent } from '../select-product-form/select-product-form.component';
import { ImageRowComponent } from '../../inventory-table-components/image-row.component';
import { ManageQuantityComponent } from '../manage-quantity/manage-quantity.component';
import { ManageVariantsQuantityComponent } from '../manage-variants-quantity/manage-variants-quantity.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouse-products-table',
	templateUrl: './warehouse-products-table.component.html',
	styleUrls: ['./warehouse-products-table.component.scss']
})
export class WarehouseProductsTableComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit {

	loading: boolean = true;
	smartTableSource = new LocalDataSource();
	settingsSmartTable: object;

	public organization: IOrganization;
	products$: Subject<boolean> = new Subject();

	warehouseProductsTable: Ng2SmartTableComponent;
	@ViewChild('warehouseProductsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.warehouseProductsTable = content;
			this.onChangedSource();
		}
	}

	@Input() warehouse: IWarehouse;

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
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.inventoryStore.warehouseProductsCountUpdate$
			.pipe(
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.warehouseProductsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.deselectAll())
			)
			.subscribe();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.warehouseProductsTable && this.warehouseProductsTable.grid) {
			this.warehouseProductsTable.grid.dataSet['willSelect'] = 'false';
			this.warehouseProductsTable.grid.dataSet.deselectAll();
		}
	}

 	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.WAREHOUSE_PRODUCT'),
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string'
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'custom',
					renderComponent: ManageQuantityComponent
				},
				variants: {
					title: this.getTranslation('INVENTORY_PAGE.MANAGE_VARIANTS_QUANTITY'),
					type: 'custom',
					renderComponent: ManageVariantsQuantityComponent
				}
			}
		};
	}

	handleImageUploadError(error) {
		this.toastrService.danger(
			error.error.message || error.message,
			'TOASTR.TITLE.ERROR'
		);
	}

	async loadItems() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		try {
			const items = await this.warehouseService.getWarehouseProducts(
				this.warehouse.id
			);
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
			this.smartTableSource.load(mappedItems);
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

		let result = await this.warehouseService.addWarehouseProducts(
			createWarehouseProductsInput,
			this.warehouse.id
		);

		if (createWarehouseProductsInput.length && result) {
			this.toastrService.success('INVENTORY_PAGE.SUCCESSFULLY_ADDED_PRODUCTS');
		}

		this.loadItems();
	}
}
