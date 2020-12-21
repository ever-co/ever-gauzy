import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IOrganization,
	IProductTypeTranslated,
	LanguagesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { ProductTypeService } from '../../../../@core/services/product-type.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, tap } from 'rxjs/operators';
import { ProductTypeMutationComponent } from '../../../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { IconRowComponent } from '../table-components/icon-row.component';
import { Store } from '../../../../@core/services/store.service';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-product-type',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	selectedProductType: IProductTypeTranslated;
	productData: IProductTypeTranslated[];
	selectedOrganization: IOrganization;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	productTypesTable: Ng2SmartTableComponent;
	@ViewChild('productTypesTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.productTypesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productTypeService: ProductTypeService,
		private toastrService: NbToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				this.selectedOrganization = org;
				if (this.selectedOrganization) {
					this.loadSettings();
				}
			});

		this.store.preferredLanguage$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				if (this.selectedOrganization) {
					this.loadSettings();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PRODUCT_TYPE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
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

	async loadSettings() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		const searchCriteria = {
			organizationId,
			tenantId
		};
		const { items } = await this.productTypeService.getAllTranslated(
			this.store.preferredLanguage || LanguagesEnum.ENGLISH,
			['organization'],
			searchCriteria
		);

		this.loading = false;
		this.productData = items;
		this.smartTableSource.load(items);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	async save(selectedItem?: IProductTypeTranslated) {
		if (selectedItem) {
			this.selectProductType({
				isSelected: true,
				data: selectedItem
			});
		}
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
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_SAVED', {
					name: productTranslations.name
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.clearItem();
		this.loadSettings();
	}

	async delete(selectedItem?: IProductTypeTranslated) {
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
			await this.productTypeService.delete(this.selectedProductType.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_DELETED', {
					name: this.selectedProductType.name
				}),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.clearItem();
	}

	selectProductType({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProductType = isSelected ? data : null;
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
