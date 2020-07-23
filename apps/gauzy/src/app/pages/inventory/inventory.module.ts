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
	NbInputModule
} from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
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

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const NB_MODULES = [
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule,
	NbSelectModule,
	NbTabsetModule,
	NbInputModule
];

@NgModule({
	declarations: [
		TableInventoryComponent,
		ProductTypesComponent,
		ProductCategoriesComponent,
		ImageRowComponent,
		IconRowComponent,
		ProductFormComponent,
		VariantFormComponent,
		InventoryComponent,
		VariantTableComponent,
		OptionsFormComponent,
		InventoryVariantFormComponent,
		EnabledStatusComponent
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
		CardGridModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		...NB_MODULES
	],
	entryComponents: [
		ProductTypeMutationComponent,
		ProductCategoryMutationComponent,
		ImageRowComponent,
		IconRowComponent,
		EnabledStatusComponent
	],
	providers: [
		ProductTypeService,
		ProductCategoryService,
		ProductService,
		ProductVariantService,
		ProductVariantSettingsService,
		ProductVariantPriceService,
		OrganizationsService
	]
})
export class InventoryModule {}
