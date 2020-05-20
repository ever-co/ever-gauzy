import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryRoutingModule } from './inventory-routing.module';
import { InventoryComponent } from './inventory-table/inventory.component';
import {
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbSpinnerModule,
	NbDialogModule,
	NbCheckboxModule
} from '@nebular/theme';
import { Ng2SmartTableModule } from 'ng2-smart-table';
import { TableComponentsModule } from '../../@shared/table-components/table-components.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { ProductMutationComponent } from '../../@shared/product-mutation/product-mutation.component';
import { ProductMutationModule } from '../../@shared/product-mutation/product-mutation.module';
import { ThemeModule } from '../../@theme/theme.module';
import { ProductVariantFormComponent } from '../../@shared/product-mutation/product-variant-form/product-variant-form.component';
import { UserFormsModule } from '../../@shared/user/forms/user-forms.module';
import { ProductTypesComponent } from './product-type/product-types.component';
import { ProductTypeMutationComponent } from '../../@shared/product-mutation/product-type-mutation/product-type-mutation.component';
import { ProductCategoriesComponent } from './product-category/product-categories.component';
import { ProductCategoryMutationComponent } from '../../@shared/product-mutation/product-category-mutation/product-category-mutation.component';
import { ImageRowComponent } from './img-row/image-row.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	declarations: [
		InventoryComponent,
		ProductTypesComponent,
		ProductCategoriesComponent,
		ImageRowComponent
	],
	imports: [
		UserFormsModule,
		InventoryRoutingModule,
		ThemeModule,
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbCheckboxModule,
		NbIconModule,
		Ng2SmartTableModule,
		TableComponentsModule,
		ProductMutationModule,
		NbDialogModule.forChild(),
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		}),
		NbSpinnerModule
	],
	entryComponents: [
		ProductMutationComponent,
		ProductVariantFormComponent,
		ProductTypeMutationComponent,
		ProductCategoryMutationComponent,
		ImageRowComponent
	]
})
export class InventoryModule {}
