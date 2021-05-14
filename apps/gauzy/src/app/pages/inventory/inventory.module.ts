import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { ProductMutationModule } from '../../@shared/product-mutation/product-mutation.module';
import { ThemeModule } from '../../@theme/theme.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ProductTypesComponent } from './components/manage-product-types/product-types.component';
import { ProductTypeMutationComponent } from '../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { ProductCategoriesComponent } from './components/manage-product-categories/product-categories.component';
import { ProductCategoryMutationComponent } from '../../@shared/product-mutation/product-category-mutation/product-category-mutation.component';
import { ImageRowComponent } from './components/table-components/image-row.component';
import { IconRowComponent } from './components/table-components/icon-row.component';
import { ProductFormComponent } from './components/edit-inventory-item/product-form.component';
import { TagsColorInputModule } from '../../@shared/tags/tags-color-input/tags-color-input.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TableInventoryComponent } from './components/table-inventory-items/table-inventory.component';
import { InventoryComponent } from './components/inventory.component';
import { SharedModule } from '../../@shared/shared.module';
import { ImageUploaderModule } from '../../@shared/image-uploader/image-uploader.module';
import { VariantTableComponent } from './components/edit-inventory-item/variant-table/variant-table.component';
import { OptionsFormComponent } from './components/edit-inventory-item/options-form/options-form.component';
import { VariantFormComponent } from './components/edit-inventory-item/variant-form/variant-form.component';
import { ProductCategoryService } from '../../@core/services/product-category.service';
import { ProductTypeService } from '../../@core/services/product-type.service';
import { ProductService } from '../../@core/services/product.service';
import { ProductVariantService } from '../../@core/services/product-variant.service';
import { ProductVariantSettingsService } from '../../@core/services/product-variant-settings.service';
import { ProductVariantPriceService } from '../../@core/services/product-variant-price.service';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { InventoryVariantFormComponent } from './components/edit-inventory-item-variant/variant-form.component';
import { EnabledStatusComponent } from './components/table-components/enabled-row.component';
import { CardGridModule } from './../../@shared/card-grid/card-grid.module';
import { CurrencyModule } from '../../@shared/currency/currency.module';
import { TranslateModule } from '../../@shared/translate/translate.module';
import { ItemImgTagsComponent } from './components/table-components/item-img-tags-row.component';
import { SelectAssetModule } from '../../@shared/select-asset-modal/select-asset.module';
import { SelectAssetComponent } from '../../@shared/select-asset-modal/select-asset.component';
import { ProductGalleryComponent } from './components/edit-inventory-item/product-gallery/product-gallery.component';
import { ImageAssetService } from '../../@core/services/image-asset.service';
import { GalleryModule } from '../../@shared/gallery/gallery.module';
import { InventoryStore } from '../../@core/services/inventory-store.service';
import { InventoryItemViewComponent } from './components/view-inventory-item/view-inventory-item.component';
import { TranslatableService } from '../../@core/services/translatable.service';
import { ImageAssetComponent } from '../../@shared/select-asset-modal/img-asset/img-asset.component';
import { ImageAssetModule } from '../../@shared/image-asset/image-asset.module';
import { WarehouseService } from '../../@core/services/warehouse.service';
import { LocationFormModule } from '../../@shared/forms/location';
import { LeafletMapModule } from '../../@shared/forms/maps/leaflet/leaflet.module';
import { WarehousesComponent } from './components/manage-warehouses/warehouses.component';
import { WarehouseFormComponent } from './components/manage-warehouses/warehouse-form/warehouse-form.component';
import { WarehousesTableComponent } from './components/manage-warehouses/warehouses-table/warehouses-table.component';
import { WarehouseProductsTableComponent } from './components/manage-warehouses/warehouse-products-table/warehouse-products-table.component';
import { SelectProductComponent } from './components/manage-warehouses/select-product-form/select-product-form.component';
import { ManageQuantityComponent } from './components/manage-warehouses/manage-quantity/manage-quantity.component';
import { ManageVariantsQuantityFormComponent } from './components/manage-warehouses/manage-variants-quantity-form/manage-variants-quantity-form.component';
import { ManageVariantsQuantityComponent } from './components/manage-warehouses/manage-variants-quantity/manage-variants-quantity.component';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { SelectedRowComponent } from './components/table-components/selected-row.component';
import { MerchantTableComponent } from './components/manage-merchants/merchant-table/merchant-table.component';
import { MerchantComponent } from './components/manage-merchants/merchant.component';
import { MerchantFormComponent } from './components/manage-merchants/merchant-form/merchant-form.component';
import { MerchantService } from 'apps/gauzy/src/app/@core';

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
	NbStepperModule
];

@NgModule({
	declarations: [
		TableInventoryComponent,
		ProductTypesComponent,
		ProductCategoriesComponent,
		ImageRowComponent,
		IconRowComponent,
		ItemImgTagsComponent,
		ProductFormComponent,
		VariantFormComponent,
		InventoryComponent,
		VariantTableComponent,
		OptionsFormComponent,
		InventoryVariantFormComponent,
		EnabledStatusComponent,
		ProductGalleryComponent,
		InventoryItemViewComponent,
		WarehousesTableComponent,
		WarehouseFormComponent,
		WarehousesComponent,
		WarehouseProductsTableComponent,
		SelectProductComponent,
		ManageQuantityComponent,
		ManageVariantsQuantityComponent,
		ManageVariantsQuantityFormComponent,
		SelectedRowComponent,
		MerchantComponent,
		MerchantTableComponent,
		MerchantFormComponent
	],
	imports: [
		UserFormsModule,
		InventoryRoutingModule,
		ThemeModule,
		CommonModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		ProductMutationModule,
		TagsColorInputModule,
		ReactiveFormsModule,
		NgSelectModule,
		FormsModule,
		SharedModule,
		ImageUploaderModule,
		GalleryModule,
		CardGridModule,
		NbBadgeModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		TranslateModule,
		...NB_MODULES,
		CurrencyModule,
		SelectAssetModule,
		ImageAssetModule,
		ImageUploaderModule,
		LocationFormModule,
		LeafletMapModule,
		HeaderTitleModule
	],
	entryComponents: [
		ProductTypeMutationComponent,
		ProductCategoryMutationComponent,
		ImageRowComponent,
		IconRowComponent,
		EnabledStatusComponent,
		SelectAssetComponent,
		ImageAssetComponent,
		SelectProductComponent
	],
	providers: [
		ProductTypeService,
		ProductCategoryService,
		ProductService,
		ProductVariantService,
		ProductVariantSettingsService,
		ProductVariantPriceService,
		OrganizationsService,
		ImageAssetService,
		InventoryStore,
		TranslatableService,
		WarehouseService,
		MerchantService
	]
})
export class InventoryModule {}
