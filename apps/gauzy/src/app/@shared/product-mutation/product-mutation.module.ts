import { NgModule } from '@angular/core';
import { ProductMutationComponent } from './product-mutation.component';
import { NgSelectModule } from '@ng-select/ng-select';
import {
	NbRadioModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbCheckboxModule,
	NbButtonModule,
	NbSelectModule,
	NbToastrModule
} from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/employee/employee.module';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ThemeModule } from '../../@theme/theme.module';
import { ProductFormComponent } from './product-form/product-form.component';
import { ProductCategoryService } from '../../@core/services/product-category.service';
import { ProductService } from '../../@core/services/product.service';
import { ProductTypeService } from '../../@core/services/product-type.service';
import { ProductVariantFormComponent } from './product-variant-form/product-variant-form.component';
import { ProductVariantService } from '../../@core/services/product-variant.service';
import { ProductVariantSettingsService } from '../../@core/services/product-variant-settings.service';
import { ProductVariantPriceService } from '../../@core/services/product-variant-price.service';
import { UserFormsModule } from '../user/forms/user-forms.module';

@NgModule({
	declarations: [
		ProductMutationComponent,
		ProductFormComponent,
		ProductVariantFormComponent
	],
	imports: [
		ThemeModule,
		NgSelectModule,
		NbRadioModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		FormsModule,
		ReactiveFormsModule,
		NbSelectModule,
		NbCheckboxModule,
		NbToastrModule,
		UserFormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	providers: [
		ProductTypeService,
		ProductCategoryService,
		ProductService,
		ProductVariantService,
		ProductVariantSettingsService,
		ProductVariantPriceService
	]
})
export class ProductMutationModule {}
