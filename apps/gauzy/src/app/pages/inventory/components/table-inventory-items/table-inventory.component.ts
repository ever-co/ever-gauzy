import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { first, take, tap } from 'rxjs/operators';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import {
	IProduct,
	IProductTypeTranslated,
	IProductCategoryTranslated,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { PictureNameTagsComponent } from '../../../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DeleteConfirmationComponent } from '../../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProductService } from '../../../../@core/services/product.service';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Store } from '../../../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-table-inventory',
	templateUrl: './table-inventory.component.html',
	styleUrls: ['./table-inventory.component.scss']
})
export class TableInventoryComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	selectedProduct: IProduct;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	selectedLanguage: string;
	inventoryData: IProduct[];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
	organization: IOrganization;

	inventoryTable: Ng2SmartTableComponent;
	@ViewChild('inventoryTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.inventoryTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private productService: ProductService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.selectedLanguage = this.translateService.currentLang;
		this.translateService.onLangChange
			.pipe(take(1))
			.subscribe((languageEvent) => {
				this.selectedLanguage = languageEvent.lang;
			});
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: IOrganization) => {
				if (organization) {
					this.organization = organization;
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
	}

	ngOnDestroy(): void {}

	setView() {
		this.viewComponentName = ComponentEnum.INVENTORY;
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
		this.inventoryTable.source.onChangedSource
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
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string'
				},
				type: {
					title: this.getTranslation('INVENTORY_PAGE.PRODUCT_TYPE'),
					type: 'string',
					valuePrepareFunction: (type: IProductTypeTranslated) => {
						return type ? type.name : '';
					}
				},
				category: {
					title: this.getTranslation(
						'INVENTORY_PAGE.PRODUCT_CATEGORY'
					),
					type: 'string',
					valuePrepareFunction: (
						category: IProductCategoryTranslated
					) => {
						return category ? category.name : '';
					}
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (description: string) => {
						return description
							? description.slice(0, 15) + '...'
							: '';
					}
				}
			}
		};
	}

	manageProductTypes() {
		this.router.navigate(['/pages/organization/inventory/product-types']);
	}

	manageProductCategories() {
		this.router.navigate([
			'/pages/organization/inventory/product-categories'
		]);
	}

	onAddInventoryItem() {
		this.router.navigate([`/pages/organization/inventory/create`]);
	}

	onEditInventoryItem(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			`/pages/organization/inventory/edit/${this.selectedProduct.id}`
		]);
	}

	async delete(selectedItem?: IProduct) {
		if (selectedItem) {
			this.selectProduct({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (!result) return;

		try {
			const res = await this.productService.delete(
				this.selectedProduct.id
			);

			if (res.affected > 0) {
				this.loadSettings();
				this.toastrService.success(
					'INVENTORY_PAGE.INVENTORY_ITEM_DELETED',
					{
						name: this.selectedProduct.name
					}
				);
			}
		} catch {
			this.toastrService.danger('TOASTR.MESSAGE.SOMETHING_BAD_HAPPENED');
		} finally {
			this.clearItem();
		}
	}

	async loadSettings() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.productService.getAll(
			['type', 'category', 'tags'],
			{ organizationId, tenantId },
			this.selectedLanguage
		);
		this.loading = false;
		this.inventoryData = items;
		this.smartTableSource.load(items);
	}

	async selectProduct({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProduct = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProduct({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.inventoryTable && this.inventoryTable.grid) {
			this.inventoryTable.grid.dataSet['willSelect'] = 'false';
			this.inventoryTable.grid.dataSet.deselectAll();
		}
	}
}
