import { NgModule } from '@angular/core';
import { InventoryRoutingModule } from './inventory-routing.module';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule,
	NbBadgeModule,
	NbTooltipModule,
	NbStepperModule
} from '@nebular/theme';
import { ProductFormComponent } from './components/edit-inventory-item/product-form.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxPermissionsModule } from 'ngx-permissions';
import {
	ImageAssetService,
	InventoryStore,
	OrganizationsService,
	ProductService,
	ProductVariantPriceService,
	ProductVariantService,
	ProductVariantSettingService,
	TranslatableService
} from '@gauzy/ui-core/core';
import {
	SmartDataViewLayoutModule,
	CardGridModule,
	CurrencyModule,
	ImageAssetModule,
	LanguageSelectorModule,
	ProductCategorySelectorModule,
	ProductTypeSelectorModule,
	SelectAssetModule,
	SharedModule,
	TagsColorInputModule
} from '@gauzy/ui-core/shared';
import { TranslateModule } from '@ngx-translate/core';
import { TableInventoryComponent } from './components/table-inventory-items/table-inventory.component';
import { InventoryComponent } from './components/inventory.component';
import { VariantTableComponent } from './components/edit-inventory-item/variant-table/variant-table.component';
import { OptionsFormComponent } from './components/edit-inventory-item/options-form/options-form.component';
import { VariantFormComponent } from './components/edit-inventory-item/variant-form/variant-form.component';
import { InventoryVariantFormComponent } from './components/edit-inventory-item-variant/variant-form.component';
import { ProductGalleryComponent } from './components/edit-inventory-item/product-gallery/product-gallery.component';
import { InventoryItemViewComponent } from './components/view-inventory-item/view-inventory-item.component';
import { MerchantModule } from './components/manage-merchants/merchant.module';
import { ProductTypesModule } from './components/manage-product-types/product-types.module';
import { ProductCategoriesModule } from './components/manage-product-categories/product-categories.module';
import { WarehousesModule } from './components/manage-warehouses/warehouses.module';
import { InventoryTableComponentsModule } from './components/inventory-table-components/inventory-table-components.module';

const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule,
	NbStepperModule,
	NbTooltipModule,
	NbBadgeModule,
	NbDialogModule.forChild()
];

@NgModule({
	declarations: [
		InventoryComponent,
		InventoryItemViewComponent,
		InventoryVariantFormComponent,
		OptionsFormComponent,
		ProductGalleryComponent,
		ProductFormComponent,
		TableInventoryComponent,
		VariantFormComponent,
		VariantTableComponent
	],
	imports: [
		CardGridModule,
		CurrencyModule,
		ImageAssetModule,
		InventoryRoutingModule,
		MerchantModule,
		...NB_MODULES,
		NgSelectModule,
		ProductTypesModule,
		ProductCategoriesModule,
		SharedModule,
		SelectAssetModule,
		InventoryTableComponentsModule,
		TagsColorInputModule,
		TranslateModule.forChild(),
		WarehousesModule,
		LanguageSelectorModule,
		SmartDataViewLayoutModule,
		ProductTypeSelectorModule,
		ProductCategorySelectorModule,
		NgxPermissionsModule.forChild()
	],
	providers: [
		ProductService,
		ProductVariantService,
		ProductVariantSettingService,
		ProductVariantPriceService,
		OrganizationsService,
		ImageAssetService,
		InventoryStore,
		TranslatableService
	]
})
export class InventoryModule {}
