import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	Organization,
	ProductTypeTranslated,
	LanguagesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { ProductTypeService } from '../../../../@core/services/product-type.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, takeUntil } from 'rxjs/operators';
import { ProductTypeMutationComponent } from '../../../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Location } from '@angular/common';
import { IconRowComponent } from '../table-components/icon-row.component';
import { Store } from '../../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';

@Component({
	selector: 'ngx-product-type',
	templateUrl: './product-types.component.html',
	styleUrls: ['./product-types.component.scss']
})
export class ProductTypesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedProductType: ProductTypeTranslated;
	productData: ProductTypeTranslated[];
	selectedOrganization: Organization;
	smartTableSource = new LocalDataSource();
	disableButton = true;
	private _ngDestroy$ = new Subject<void>();
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	@ViewChild('productTypesTable', { static: true }) productTypesTable;

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private productTypeService: ProductTypeService,
		private toastrService: NbToastrService,
		private location: Location,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				this.selectedOrganization = org;
				this.loadSettings();
			});

		this.store.preferredLanguage$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSettings();
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
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
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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
		this.selectedProductType = null;
		const searchCriteria = this.selectedOrganization
			? { organization: { id: this.selectedOrganization.id } }
			: null;

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
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	async save(selectedItem?: ProductTypeTranslated) {
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
		this.selectedProductType = null;
		this.disableButton = true;

		if (productType) {
			this.toastrService.primary(
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_SAVED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async delete(selectedItem?: ProductTypeTranslated) {
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
				this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	selectProductType({ isSelected, data }) {
		const selectedProductType = isSelected ? data : null;
		if (this.productTypesTable) {
			this.productTypesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedProductType = selectedProductType;
	}

	goBack() {
		this.location.back();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
