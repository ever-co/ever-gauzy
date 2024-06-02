import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import {
	IProduct,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProductTranslated,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from './../../../../@shared/pagination/pagination-filter-base.component';
import { API_PREFIX, ComponentEnum } from '@gauzy/ui-sdk/common';
import { ProductService, Store } from '../../../../@core/services';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { TagsOnlyComponent } from './../../../../@shared/table-components';
import { ImageRowComponent, NameWithDescriptionComponent } from '../inventory-table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-table-inventory',
	templateUrl: './table-inventory.component.html',
	styleUrls: ['./table-inventory.component.scss']
})
export class TableInventoryComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean = false;
	disableButton: boolean = true;
	selectedProduct: IProduct;
	smartTableSource: ServerDataSource;
	products: IProductTranslated[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	permissionsEnum = PermissionsEnum;

	public organization: IOrganization;
	products$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	constructor(
		private readonly http: HttpClient,
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly productService: ProductService,
		private readonly router: Router,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit() {
		this.products$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getTranslatedProducts()),
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

		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization]) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.products$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.products = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.INVENTORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.products = [])),
				tap(() => this.products$.next(true)),
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
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.INVENTORY'),
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					width: '79px',
					filter: false,
					type: 'custom',
					renderComponent: ImageRowComponent,
					componentInitFunction: (instance: ImageRowComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: NameWithDescriptionComponent,
					componentInitFunction: (instance: NameWithDescriptionComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string'
				},
				productType: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string',
					valuePrepareFunction: (value: string) => value || '-'
				},
				productCategory: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_CATEGORY'),
					type: 'string',
					valuePrepareFunction: (value: string) => value || '-'
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.TAGS'),
					type: 'custom',
					filter: false,
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	manageProductTypes() {
		this.router.navigate(['/pages/organization/inventory/product-types']);
	}

	manageProductCategories() {
		this.router.navigate(['/pages/organization/inventory/product-categories']);
	}

	manageWarehouses() {
		this.router.navigate(['/pages/organization/inventory/warehouses']);
	}

	manageStores() {
		this.router.navigate(['/pages/organization/inventory/merchants']);
	}

	onAddInventoryItem() {
		this.router.navigate([`/pages/organization/inventory/create`]);
	}

	/**
	 * Navigate to the edit page of a selected inventory item.
	 *
	 * @param {IProduct} selectedItem - The selected inventory item to edit.
	 */
	onEditInventoryItem(selectedItem?: IProduct): void {
		// If a selected item is provided, update the selected product
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}

		// Navigate to the edit page with the selected product's ID
		this.router.navigate([`/pages/organization/inventory/edit`, this.selectedProduct.id]);
	}

	/**
	 * Navigate to the detailed view of a selected inventory item.
	 *
	 * @param {IProduct} selectedItem - The selected inventory item to view.
	 */
	onViewInventoryItem(selectedItem?: IProduct): void {
		// If a selected item is provided, update the selected product
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}

		// Navigate to the detailed view page with the selected product's ID
		this.router.navigate([`/pages/organization/inventory/view`, this.selectedProduct.id]);
	}

	/**
	 * Asynchronously deletes a product.
	 *
	 * @param {IProduct} selectedItem - The selected product to be deleted.
	 */
	async delete(selectedItem?: IProduct): Promise<void> {
		// If a selected product is provided, update the selected product
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open a confirmation dialog and wait for the result
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		// If the user cancels the deletion, return early
		if (!result) return;

		try {
			// Attempt to delete the selected product using the ProductService
			const res = await this.productService.delete(this.selectedProduct.id);

			// Check if the deletion was successful based on the response
			if (res.affected > 0) {
				// Display a success toast notification
				this.toastrService.success('INVENTORY_PAGE.INVENTORY_ITEM_DELETED', {
					name: this.selectedProduct.name
				});
			}
		} catch {
			// Handle errors by displaying a danger toast notification
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		} finally {
			// Trigger a refresh and notify subscribers
			this._refresh$.next(true);
			this.products$.next(true);
		}
	}

	/**
	 * Registers and configures the Smart Table source for displaying product data.
	 * If the organization context is unavailable, the function returns early.
	 * The function sets up a server data source for pagination, relations, and filters.
	 * It maps the result for each product and finalizes the setup by updating pagination and handling loading states.
	 *
	 * @throws {Error} If an error occurs during the setup, a danger toast notification is displayed.
	 */
	setSmartTableSource(): void {
		// Check if the organization context is available
		if (!this.organization) {
			return;
		}

		try {
			// Set loading state to true while fetching data
			this.loading = true;

			// Destructure properties for clarity
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			// Create a new ServerDataSource for Smart Table
			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/products/pagination`,
				relations: ['productType', 'productCategory', 'tags', 'featuredImage'],
				// Define query parameters for the API request
				where: {
					organizationId,
					tenantId,
					...this.filters.where
				},
				// Define how to map the result for each product
				resultMap: (product: IProductTranslated) => {
					return Object.assign({}, product);
				},
				// Finalize callback to handle post-processing
				finalize: () => {
					// Update products based on the data layout style
					if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
						this.products.push(...this.smartTableSource.getData());
					}

					// Update pagination based on the count of items in the source
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					// Set loading state to false once data fetching is complete
					this.loading = false;
				}
			});
		} catch (error) {
			// Handle errors by displaying a danger toast notification
			this.toastrService.danger(error);
		}
	}

	/**
	 * Asynchronously sets up and retrieves translated product inventory data for a smart table.
	 * If the organization context is unavailable, the function returns early.
	 * The function sets up a smart table source, configures pagination, and fetches elements based on the data layout style.
	 *
	 * @throws {Error} If an error occurs during the setup or data retrieval, a danger toast notification is displayed.
	 */
	private async getTranslatedProducts(): Promise<void> {
		// Check if the organization context is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the smart table source
			this.setSmartTableSource();

			// Configure pagination based on the active page and items per page
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Fetch elements for the smart table based on the data layout style
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			// Handle errors by displaying a danger toast notification
			this.toastrService.danger(error);
		}
	}

	selectProduct({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProduct = isSelected ? data : null;
	}

	private _applyTranslationOnSmartTable() {
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
		this.selectProduct({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
