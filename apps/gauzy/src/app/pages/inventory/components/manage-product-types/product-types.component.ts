import { Component, OnInit, ViewChild, OnDestroy, TemplateRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IOrganization, IProductTypeTranslated, ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService, ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import { ProductTypeService, Store } from '../../../../@core/services';
import { ProductTypeMutationComponent } from '../../../../@shared/product-mutation';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms';
import { IconRowComponent } from '../inventory-table-components';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from './../../../../@shared/pagination/pagination-filter-base.component';
import { InputFilterComponent } from './../../../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-types',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	smartTableSource: ServerDataSource;
	settingsSmartTable: object;
	loading: boolean = false;
	disableButton: boolean = true;
	selectedProductType: IProductTypeTranslated;
	productTypes: IProductTypeTranslated[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	types$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly http: HttpClient,
		private readonly dialogService: NbDialogService,
		private readonly productTypeService: ProductTypeService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.types$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getTranslatedProductTypes()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.types$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const preferredLanguage$ = this.store.preferredLanguage$;
		combineLatest([storeOrganization$, preferredLanguage$])
			.pipe(
				debounceTime(300),
				filter(([organization, language]) => !!organization && !!language),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(() => this._refresh$.next(true)),
				tap(() => this.types$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.productTypes = [])),
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
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.productTypes = [])),
				tap(() => this.types$.next(true)),
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
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PRODUCT_TYPE_NO_DATA'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				icon: {
					title: this.getTranslation('INVENTORY_PAGE.ICON'),
					width: '5%',
					filter: false,
					type: 'custom',
					renderComponent: IconRowComponent,
					componentInitFunction: (instance: IconRowComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string',
					width: '40%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					}
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
			const dialog = this.dialogService.open(ProductTypeMutationComponent);
			const productType = await firstValueFrom(dialog.onClose);

			if (productType) {
				this.toastrService.success('INVENTORY_PAGE.PRODUCT_TYPE_SAVED', {
					name: productType.name
				});
				this._refresh$.next(true);
				this.types$.next(true);
			}
		} catch (error) {
			console.log('Error while creating product types', error);
		}
	}

	async onEdit(selectedItem?: IProductTypeTranslated) {
		if (selectedItem) {
			this.selectProductType({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.organization) {
			return;
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

			const productType = await firstValueFrom(dialog.onClose);
			if (productType) {
				let translation = productType.translations[0];
				this.toastrService.success('INVENTORY_PAGE.PRODUCT_TYPE_SAVED', {
					name: translation.name
				});
				this._refresh$.next(true);
				this.types$.next(true);
			}
		} catch (error) {
			console.log('Error while updating product types', error);
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

			const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

			if (result) {
				if (this.selectedProductType) {
					await this.productTypeService
						.delete(this.selectedProductType.id)
						.then(() => {
							this.toastrService.success('INVENTORY_PAGE.PRODUCT_TYPE_DELETED', {
								name: this.selectedProductType.name
							});
						})
						.finally(() => {
							this._refresh$.next(true);
							this.types$.next(true);
						});
				}
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
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
		if (!this.organization) {
			return;
		}
		try {
			this.loading = true;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/product-types/pagination`,
				relations: [],
				where: {
					...{ organizationId, tenantId },
					...this.filters.where
				},
				resultMap: (item: IProductTypeTranslated) => {
					return Object.assign({}, item);
				},
				finalize: () => {
					if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
						this.productTypes.push(...this.smartTableSource.getData());
					}
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
					this.loading = false;
				}
			});
		} catch (error) {
			this._errorHandlingService.handleError(error);
			this.loading = false;
		}
	}

	/**
	 * GET product types smart table source
	 */
	private async getTranslatedProductTypes() {
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
		this.selectProductType({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}
