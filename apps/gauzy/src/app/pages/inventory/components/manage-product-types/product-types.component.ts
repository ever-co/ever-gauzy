import { Component, OnInit, ViewChild, OnDestroy, TemplateRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganization,
	IProductTypeTranslated,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	ProductTypeService,
	Store,
	ToastrService
} from '../../../../@core/services';
import { ProductTypeMutationComponent } from '../../../../@shared/product-mutation';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { IconRowComponent } from './../table-components';
import { API_PREFIX, ComponentEnum } from '../../../../@core/constants';
import { PaginationFilterBaseComponent } from './../../../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource } from './../../../../@core/utils/smart-table/server.data-source';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-types',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent
	extends PaginationFilterBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	pagination: any = {
		...this.pagination,
		itemsPerPage: 8
	};
	smartTableSource: ServerDataSource;
	settingsSmartTable: object;
	loading: boolean;
	selectedProductType: IProductTypeTranslated;
	productTypes: IProductTypeTranslated[] = [];
	disableButton: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	types$: Subject<any> = this.subject$;

	productTypesTable: Ng2SmartTableComponent;
	@ViewChild('productTypesTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.productTypesTable = content;
			this.onChangedSource();
		}
	}
	
	/*
	* Actions Buttons directive 
	*/
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;
 
	constructor(
		public readonly translateService: TranslateService,
		private readonly http: HttpClient, 
		private readonly dialogService: NbDialogService,
		private readonly productTypeService: ProductTypeService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit() {
		this.types$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getTranslatedProductTypes()),
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
				tap(() => this.types$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_TYPE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.types$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.productTypesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
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
				icon: {
					title: this.getTranslation('INVENTORY_PAGE.ICON'),
					width: '5%',
					filter: false,
					type: 'custom',
					renderComponent: IconRowComponent
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

	async onAddEdit(selectedItem?: IProductTypeTranslated) {
		if (selectedItem) {
			this.selectProductType({
				isSelected: true,
				data: selectedItem
			});
		}

		try {
			const editProductType = this.selectedProductType
				? await this.productTypeService.getById(this.selectedProductType.id)
				: null;
	
			const dialog = this.dialogService.open(ProductTypeMutationComponent, {
				context: {
					productType: editProductType
				}
			});
	
			const productType = await dialog.onClose.pipe(first()).toPromise();
			if (productType) {
				let productTranslations = productType.translations[0];
				this.toastrService.success('INVENTORY_PAGE.PRODUCT_TYPE_SAVED', {
					name: productTranslations.name
				});
				this.types$.next();
			}
		} catch (error) {
			this.types$.next();
		}		
	}

	async delete(selectedItem?: IProductTypeTranslated) {
		try {
			if (selectedItem) {
				this.selectProductType({
					isSelected: true,
					data: selectedItem
				});
			}
	
			const result = await this.dialogService
				.open(DeleteConfirmationComponent)
				.onClose.pipe(first())
				.toPromise();

			if (result) {
				if (this.selectedProductType) {
					await this.productTypeService.delete(this.selectedProductType.id)
						.then(() => {
							this.toastrService.success('INVENTORY_PAGE.PRODUCT_TYPE_DELETED', {
								name: this.selectedProductType.name
							});
						}) 
						.finally(() => {
							this.types$.next();
						});
				}
			}	
		} catch (error) {
			this.types$.next();
		}
	}

	selectProductType({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProductType = isSelected ? data : null;
	}


	/**
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/product-types/pagination`,
			relations: [],
			where: {
				...{ organizationId, tenantId }
			},
			resultMap: (item: IProductTypeTranslated) => {
				return Object.assign({}, item);
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * GET product types smart table source
	 */
	 private async getTranslatedProductTypes() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.productTypes = this.smartTableSource.getData();

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
		this.selectProductType({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.productTypesTable && this.productTypesTable.grid) {
			this.productTypesTable.grid.dataSet['willSelect'] = 'false';
			this.productTypesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
