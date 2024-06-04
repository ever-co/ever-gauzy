import { AfterViewInit, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IProductCategoryTranslated, IOrganization, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ImageRowComponent } from '../inventory-table-components';
import { ProductCategoryMutationComponent } from '../../../../@shared/product-mutation';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { API_PREFIX, ComponentEnum } from '@gauzy/ui-sdk/common';
import { Store } from '@gauzy/ui-sdk/common';
import { ProductCategoryService } from '@gauzy/ui-sdk/core';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from './../../../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-categories',
	templateUrl: './product-categories.component.html',
	styleUrls: ['./product-categories.component.scss']
})
export class ProductCategoriesComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	smartTableSource: ServerDataSource;
	settingsSmartTable: object;
	loading: boolean = false;
	disableButton: boolean = true;
	selectedProductCategory: IProductCategoryTranslated;
	productCategories: IProductCategoryTranslated[] = [];
	selectedOrganization: IOrganization;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	categories$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

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

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.categories$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getTranslatedProductCategories()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.categories$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(300),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(() => this._refresh$.next(true)),
				tap(() => this.categories$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.productCategories = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_CATEGORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.productCategories = [])),
				tap(() => this.categories$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PRODUCT_CATEGORY'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				imageUrl: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					width: '10%',
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

	async onAdd() {
		if (!this.organization) {
			return;
		}
		try {
			const dialog = this.dialogService.open(ProductCategoryMutationComponent);
			const productCategory = await firstValueFrom(dialog.onClose);

			if (productCategory) {
				this.toastrService.success('INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED', {
					name: productCategory.name
				});
				this._refresh$.next(true);
				this.categories$.next(true);
			}
		} catch (error) {
			console.log('Error while creating product categories', error);
		}
	}

	async onEdit(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.organization) {
			return;
		}

		try {
			const editProductCategory = this.selectedProductCategory
				? await this.productCategoryService.getById(this.selectedProductCategory.id)
				: null;

			const dialog = this.dialogService.open(ProductCategoryMutationComponent, {
				context: {
					productCategory: editProductCategory
				}
			});
			const productCategory = await firstValueFrom(dialog.onClose);

			if (productCategory) {
				let productCategoryTranslation = productCategory.translations[0];
				this.toastrService.success('INVENTORY_PAGE.PRODUCT_CATEGORY_SAVED', {
					name: productCategoryTranslation?.name
				});
				this._refresh$.next(true);
				this.categories$.next(true);
			}
		} catch (error) {
			console.log('Error while updating product categories', error);
		}
	}

	async delete(selectedItem?: IProductCategoryTranslated) {
		if (selectedItem) {
			this.selectProductCategory({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			if (this.selectedProductCategory) {
				const { id, name } = this.selectedProductCategory;
				await this.productCategoryService
					.delete(id)
					.then(() => {
						this.toastrService.success('INVENTORY_PAGE.PRODUCT_CATEGORY_DELETED', {
							name
						});
					})
					.finally(() => {
						this._refresh$.next(true);
						this.categories$.next(true);
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
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/product-categories/pagination`,
				relations: ['translations'],
				where: {
					...{ organizationId, tenantId },
					...this.filters.where
				},
				resultMap: (item: IProductCategoryTranslated) => {
					return Object.assign({}, item);
				},
				finalize: () => {
					if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
						this.productCategories.push(...this.smartTableSource.getData());
					}
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this.loading = false;
			this.toastrService.danger(error);
		}
	}

	/**
	 * GET product categories smart table source
	 */
	private async getTranslatedProductCategories() {
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

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProductCategory({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
