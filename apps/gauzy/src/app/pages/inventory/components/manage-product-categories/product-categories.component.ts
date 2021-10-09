import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IProductCategoryTranslated,
	IOrganization,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ImageRowComponent } from './../table-components';
import { ProductCategoryMutationComponent } from '../../../../@shared/product-mutation';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { API_PREFIX, ComponentEnum } from '../../../../@core/constants';
import { ProductCategoryService, Store, ToastrService } from './../../../../@core/services';
import { PaginationFilterBaseComponent } from './../../../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource } from './../../../../@core/utils/smart-table/server.data-source';
import { combineLatest } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit {

	pagination: any = {
		...this.pagination,
		itemsPerPage: 8
	};
	smartTableSource: ServerDataSource;
	settingsSmartTable: object;
	loading: boolean;
	selectedProductCategory: IProductCategoryTranslated;
	productCategories: IProductCategoryTranslated[] = [];
	selectedOrganization: IOrganization;
	disableButton: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	categories$: Subject<any> = this.subject$;

	productCategoriesTable: Ng2SmartTableComponent;
	@ViewChild('productCategoriesTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.productCategoriesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogService: NbDialogService,
		private readonly productCategoryService: ProductCategoryService,
		private readonly toastrService: ToastrService,
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

	ngAfterViewInit() {
		this.categories$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getTranslatedProductCategories()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$

		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(300),
				filter(([organization, language]) => !!organization && !!language),
				tap(([ organization ]) => this.organization = organization),
				distinctUntilChange(),
				tap(() => this.categories$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.productCategoriesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_CATEGORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.categories$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: this.pagination.itemsPerPage
			},
			columns: {
				imageUrl: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					width: '10%',
					filter: false,
					type: 'custom',
					renderComponent: ImageRowComponent
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string',
					width: '40%'
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false
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

	async onAddEdit(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}

		const editProductCategory = this.selectedProductCategory
			? await this.productCategoryService.getById(
				this.selectedProductCategory.id
			)
			: null;

		const dialog = this.dialogService.open(ProductCategoryMutationComponent, {
			context: {
				productCategory: editProductCategory
			}
		});

		const productCategory = await dialog.onClose.pipe(first()).toPromise();
		if (productCategory) {
			let productCatTranslaction = productCategory.translations[0];
			this.toastrService.success('INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED', {
				name: productCatTranslaction?.name
			});
		}
		this.categories$.next();
	}

	async delete(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			if (this.selectedProductCategory) {
				const { id, name } = this.selectedProductCategory;
				await this.productCategoryService.delete(id)
					.then(() => {
						this.toastrService.success('INVENTORY_PAGE.PRODUCT_CATEGORY_DELETED', {
							name
						});
					})
					.finally(() => {
						this.categories$.next();
					});
			}
		}
	}

	selectProductCategory({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProductCategory = isSelected ? data : null;
	}

	/**
	 * Register Smart Table Source Config
	 */
	 setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/product-categories/pagination`,
			relations: [],
			where: {
				...{ organizationId, tenantId }
			},
			resultMap: (item: IProductCategoryTranslated) => {
				return Object.assign({}, item);
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * GET product categories smart table source
	 */
	 private async getTranslatedProductCategories() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.productCategories = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}


	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProductCategory({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.productCategoriesTable && this.productCategoriesTable.grid) {
			this.productCategoriesTable.grid.dataSet['willSelect'] = 'false';
			this.productCategoriesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
