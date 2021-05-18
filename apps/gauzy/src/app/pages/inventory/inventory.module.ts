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
import { ProductMutationModule } from '../../@shared/product-mutation/product-mutation.module';
import { ThemeModule } from '../../@theme/theme.module';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
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
import { LocationFormModule } from '../../@shared/forms/location';
import { LeafletMapModule } from '../../@shared/forms/maps/leaflet/leaflet.module';
import { SelectProductComponent } from './components/manage-warehouses/select-product-form/select-product-form.component';
import { HeaderTitleModule } from '../../@shared/components/header-title/header-title.module';
import { MerchantModule } from './components/manage-merchants/merchant.module';
import { ProductTypesModule } from './components/manage-product-types/product-types.module';
import { ProductCategoriesModule } from './components/manage-product-categories/product-categories.module';
import { WarehousesModule } from './components/manage-warehouses/warehouses.module';
import { TableComponentsModule } from './components/table-components/table-components.module';


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
	NbDialogModule.forChild(),
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
		VariantTableComponent,
	],
	imports: [
		// UserFormsModule,
		// TableComponentsModule,
		// ProductMutationModule,
		// ImageUploaderModule,
		// GalleryModule,
		// SelectAssetModule,
		// ImageAssetModule,
		// ImageUploaderModule,

		CardGridModule,
		CommonModule,
		CurrencyModule,
		FormsModule,
		HeaderTitleModule,
		InventoryRoutingModule,
		MerchantModule,
		...NB_MODULES,
		NgSelectModule,
		Ng2SmartTableModule,
		ProductTypesModule,
		ProductCategoriesModule,
		ReactiveFormsModule,
		SharedModule,
		TableComponentsModule,
		TagsColorInputModule,
		ThemeModule,
		TranslateModule,
		WarehousesModule
	],
	entryComponents: [
		// ImageRowComponent,
		// IconRowComponent,
		// EnabledStatusComponent,
		// SelectAssetComponent,
		// ImageAssetComponent,
		// SelectProductComponent
	],
	providers: [
		ProductService,
		ProductVariantService,
		ProductVariantSettingsService,
		ProductVariantPriceService,
		OrganizationsService,
		ImageAssetService,
		InventoryStore,
		TranslatableService
	]
})
export class InventoryModule { }
