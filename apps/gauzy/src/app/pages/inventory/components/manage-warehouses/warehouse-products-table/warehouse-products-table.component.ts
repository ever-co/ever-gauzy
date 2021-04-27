import {
	ITag,
	IWarehouse,
	IProductTranslatable,
	IOrganization
} from '@gauzy/contracts';
import { FormBuilder, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { WarehouseService } from 'apps/gauzy/src/app/@core/services/warehouse.service';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Location } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { ProductService } from 'apps/gauzy/src/app/@core';
import { NbDialogService } from '@nebular/theme';
import { SelectProductComponent } from '../select-product-form/select-product-form.component';
import { first } from 'rxjs/operators';
import { ImageRowComponent } from '../../table-components/image-row.component';

@UntilDestroy()
@Component({
	selector: 'ga-warehouse-products-table',
	templateUrl: './warehouse-products-table.component.html',
	styleUrls: ['./warehouse-products-table.component.scss']
})
export class WarehouseProductsTableComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	tags: ITag[] = [];
	loading: boolean = true;

	warehouse: IWarehouse;
	warehouseId: String = '';
	smartTableSource = new LocalDataSource();
	warehouseProducts: IProductTranslatable[] = [];
	organization: IOrganization;

	settingsSmartTable: object;
	warehoutProductTable: Ng2SmartTableComponent;

	stockData: any = [];

	@ViewChild('warehouseStockTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.warehoutProductTable = content;
			//tstodo
			// this.onChangedSource();
		}
	}

	constructor(
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private warehouseService: WarehouseService,
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private fb: FormBuilder,
		private store: Store,
		private location: Location,
		private productService: ProductService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadSmartTable();

		this.setRouteSubscription();

		this.loadItems();

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
					this.loadItems();
				}
			});
	}

	private setRouteSubscription() {
		this.route.params
			.pipe(untilDestroyed(this))
			.subscribe(async (params) => {
				this.warehouseId = params.id;
				this.warehouse = await this.warehouseService.getById(params.id);
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: true,
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
					type: 'number'
				}
			}
		};
	}

	handleImageUploadError(error) {}

	async loadItems() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const items = await this.warehouseService.getWarehouseProducts(
			this.warehouseId
		);
		this.loading = false;
		this.stockData = items;

		let mappedItems = items
			? items.map((item) => {
					return {
						...item,
						name: item.product.translations[0]['name'],
						featuredImage: item.product.featuredImage,
						quantity: 0
					};
			  })
			: [];

		this.smartTableSource.load(mappedItems);
	}

	async onAddProduct() {
		const dialog = this.dialogService.open(SelectProductComponent, {});

		const selectedProducts = await dialog.onClose.pipe(first()).toPromise();

		let createWarehouseProductsInput = selectedProducts
			? selectedProducts.map((pr) => {
					return {
						productId: pr.id,
						variants: pr.variants.map((variant) => variant.id)
					};
			  })
			: [];

		let result = await this.warehouseService.addWarehouseProducts(
			createWarehouseProductsInput,
			this.warehouseId
		);

		if (result) {
			this.toastrService.success('Successfully added products');
		}

		this.loadItems();
	}

	async onSaveRequest() {}

	cancel() {
		this.location.back();
	}
}
